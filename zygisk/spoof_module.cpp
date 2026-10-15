#include <jni.h>
#include <string>
#include <zygisk.hpp>
#include <json.hpp>
#include <fstream>
#include <android/log.h>
#include "device_info.hpp"
#include "device_config.hpp"

using json = nlohmann::json;
using copgvd::DeviceInfo;
using copgvd::trim;

#define LOG_TAG "COPG-VD"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define ERROR_LOG(...) LOGE("[ERROR] " __VA_ARGS__)

static const std::string config_file = "/data/adb/COPG-VD.json";
// What the ROM really is. NEVER a system property: the module rewrites those very props, so
// asking the system would be asking our own lie. /build.prop does not exist on these devices;
// on a custom ROM the fingerprint line inside this file is stale, but ro.build.version.* is good.
static const std::string rom_prop_file = "/system/build.prop";
static const std::string version_policy_file = "/data/adb/modules/COPG-VD/.spoof.version";









class COPGVDModule : public zygisk::ModuleBase {
private:
    zygisk::Api* api = nullptr;
    JNIEnv* env = nullptr;

    // Value-initialized: setInt/setLong only skip a field when it is 0, so an
    // indeterminate int here would be written straight into Build.TIME.
    DeviceInfo spoof_info{};

    void spoofDevice() {
        jclass buildClass = env->FindClass("android/os/Build");
        if (!buildClass) {
            env->ExceptionClear();
            return;
        }

        auto getField = [this](jclass cls, const char* name, const char* sig) -> jfieldID {
            jfieldID id = env->GetStaticFieldID(cls, name, sig);
            if (env->ExceptionCheck()) env->ExceptionClear();
            return id;
        };

        jfieldID build_modelField = getField(buildClass, "MODEL", "Ljava/lang/String;");
        jfieldID build_brandField = getField(buildClass, "BRAND", "Ljava/lang/String;");
        jfieldID build_deviceField = getField(buildClass, "DEVICE", "Ljava/lang/String;");
        jfieldID build_manufacturerField = getField(buildClass, "MANUFACTURER", "Ljava/lang/String;");
        jfieldID build_fingerprintField = getField(buildClass, "FINGERPRINT", "Ljava/lang/String;");
        jfieldID build_productField = getField(buildClass, "PRODUCT", "Ljava/lang/String;");
        jfieldID build_boardField = getField(buildClass, "BOARD", "Ljava/lang/String;");
        jfieldID build_bootloaderField = getField(buildClass, "BOOTLOADER", "Ljava/lang/String;");
        jfieldID build_hardwareField = getField(buildClass, "HARDWARE", "Ljava/lang/String;");
        jfieldID build_idField = getField(buildClass, "ID", "Ljava/lang/String;");
        jfieldID build_displayField = getField(buildClass, "DISPLAY", "Ljava/lang/String;");
        jfieldID build_hostField = getField(buildClass, "HOST", "Ljava/lang/String;");
        jfieldID build_odm_skuField = getField(buildClass, "ODM_SKU", "Ljava/lang/String;");
        jfieldID build_skuField = getField(buildClass, "SKU", "Ljava/lang/String;");
        jfieldID build_tagsField = getField(buildClass, "TAGS", "Ljava/lang/String;");
        jfieldID build_timeField = getField(buildClass, "TIME", "J");
        jfieldID build_typeField = getField(buildClass, "TYPE", "Ljava/lang/String;");
        jfieldID build_userField = getField(buildClass, "USER", "Ljava/lang/String;");

        jclass versionClass = env->FindClass("android/os/Build$VERSION");
        jfieldID build_version_releaseField = nullptr;
        jfieldID build_version_sdk_intField = nullptr;
        jfieldID build_version_codenameField = nullptr;
        jfieldID build_version_incrementalField = nullptr;
        jfieldID build_version_sdkField = nullptr;
        jfieldID build_version_sdk_int_fullField = nullptr;
        jfieldID build_version_security_patchField = nullptr;
        jfieldID build_version_release_or_codenameField = nullptr;
        jfieldID build_version_release_or_preview_displayField = nullptr;

        if (versionClass) {
            build_version_releaseField = getField(versionClass, "RELEASE", "Ljava/lang/String;");
            build_version_sdk_intField = getField(versionClass, "SDK_INT", "I");
            build_version_codenameField = getField(versionClass, "CODENAME", "Ljava/lang/String;");
            build_version_incrementalField = getField(versionClass, "INCREMENTAL", "Ljava/lang/String;");
            build_version_sdkField = getField(versionClass, "SDK", "Ljava/lang/String;");
            build_version_sdk_int_fullField = getField(versionClass, "SDK_INT_FULL", "I");
            build_version_security_patchField = getField(versionClass, "SECURITY_PATCH", "Ljava/lang/String;");
            build_version_release_or_codenameField = getField(versionClass, "RELEASE_OR_CODENAME", "Ljava/lang/String;");
            build_version_release_or_preview_displayField = getField(versionClass, "RELEASE_OR_PREVIEW_DISPLAY", "Ljava/lang/String;");
        }

        std::ifstream file(config_file);
        if (!file.is_open()) {
            ERROR_LOG("Failed to open: %s", config_file.c_str());
            env->DeleteLocalRef(buildClass);
            if (versionClass) env->DeleteLocalRef(versionClass);
            return;
        }

        try {
            const json config = json::parse(file);
            spoof_info = copgvd::readDeviceInfo(config, LOG_TAG, rom_prop_file, version_policy_file);
        } catch (const std::exception& e) {
            ERROR_LOG("Config error: %s", e.what());
            env->DeleteLocalRef(buildClass);
            if (versionClass) env->DeleteLocalRef(versionClass);
            return;
        }

        auto setStr = [this](jclass thisClass, jfieldID field, const std::string& value) {
            if (!field || trim(value).empty()) return;
            jstring js = env->NewStringUTF(value.c_str());
            if (!js || env->ExceptionCheck()) {
                env->ExceptionClear();
                return;
            }
            env->SetStaticObjectField(thisClass, field, js);
            env->DeleteLocalRef(js);
            if (env->ExceptionCheck()) env->ExceptionClear();
        };

        auto setInt = [this](jclass thisClass, jfieldID field, int value) {
            if (!field || value == 0) return;
            env->SetStaticIntField(thisClass, field, value);
            if (env->ExceptionCheck()) env->ExceptionClear();
        };

        auto setLong = [this](jclass thisClass, jfieldID field, std::int64_t value) {
            if (!field || value == 0) return;
            env->SetStaticLongField(thisClass, field, value);
            if (env->ExceptionCheck()) env->ExceptionClear();
        };

        setStr(buildClass, build_modelField, spoof_info.model);
        setStr(buildClass, build_brandField, spoof_info.brand);
        setStr(buildClass, build_deviceField, spoof_info.device);
        setStr(buildClass, build_manufacturerField, spoof_info.manufacturer);
        setStr(buildClass, build_fingerprintField, spoof_info.fingerprint);
        setStr(buildClass, build_productField, spoof_info.product);
        setStr(buildClass, build_boardField, spoof_info.board);
        setStr(buildClass, build_bootloaderField, spoof_info.bootloader);
        setStr(buildClass, build_hardwareField, spoof_info.hardware);
        setStr(buildClass, build_idField, spoof_info.id);
        setStr(buildClass, build_displayField, spoof_info.display);
        setStr(buildClass, build_hostField, spoof_info.host);
        setStr(buildClass, build_odm_skuField, spoof_info.odm_sku);
        setStr(buildClass, build_skuField, spoof_info.sku);
        setStr(buildClass, build_userField, spoof_info.user);
        setLong(buildClass, build_timeField, spoof_info.time);
        setStr(buildClass, build_tagsField, "release-keys");
        setStr(buildClass, build_typeField, "user");

        if (versionClass) {
            setStr(versionClass, build_version_codenameField, spoof_info.version_codename);
            setStr(versionClass, build_version_incrementalField, spoof_info.version_incremental);
            setStr(versionClass, build_version_sdkField, spoof_info.version_sdk);
            setInt(versionClass, build_version_sdk_int_fullField, spoof_info.version_sdk_int_full);
            setStr(versionClass, build_version_security_patchField, spoof_info.version_security_patch);
            setStr(versionClass, build_version_releaseField, spoof_info.android_version);
            setInt(versionClass, build_version_sdk_intField, spoof_info.version_sdk_int);
            setStr(versionClass, build_version_release_or_codenameField, spoof_info.version_release_or_codename);
            setStr(versionClass, build_version_release_or_preview_displayField, spoof_info.version_release_or_preview_display);
        }

        env->DeleteLocalRef(buildClass);
        if (versionClass) env->DeleteLocalRef(versionClass);
    }

public:
    void onLoad(zygisk::Api* api, JNIEnv* env) override {
        this->api = api;
        this->env = env;

        spoofDevice();

        api->setOption(zygisk::DLCLOSE_MODULE_LIBRARY);
    }
};

REGISTER_ZYGISK_MODULE(COPGVDModule)
