#pragma once

#include <exception>
#include <string>

#include "json.hpp"

#include "device_info.hpp"

namespace copgvd {

inline DeviceInfo readDeviceInfo(const nlohmann::json& config,
                                const std::string& section,
                                const std::string& prop_file,
                                const std::string& policy_file) {
    DeviceInfo info{};
    if (!config.contains(section) || !config[section].is_object()) return info;

    const auto device = config[section];
    info.brand = device.value("BRAND", "");
    info.device = device.value("DEVICE", "");
    info.manufacturer = device.value("MANUFACTURER", "");
    info.model = device.value("MODEL", "");
    info.fingerprint = device.value("FINGERPRINT", "");
    info.product = device.value("PRODUCT", "");
    info.board = device.value("BOARD", "");
    info.bootloader = device.value("BOOTLOADER", "");
    info.hardware = device.value("HARDWARE", "");
    info.id = device.value("ID", "");
    info.display = device.value("DISPLAY", "");
    info.host = device.value("HOST", "");
    info.odm_sku = device.value("ODM_SKU", info.product);
    info.sku = device.value("SKU", info.hardware);
    info.user = device.value("USER", "");
    info.version_incremental = device.value("INCREMENTAL", "");
    info.version_security_patch = device.value("SECURITY_PATCH", "");
    if (device.contains("TIMESTAMP")) {
        const auto& device_timestamp = device["TIMESTAMP"];
        info.time = std::stoll(device_timestamp.get<std::string>()) * 1000;
    }

    const RomVersion rom = readRomVersion(prop_file);
    const VersionPolicy policy = readVersionPolicy(policy_file);
    auto allowed = [&rom, policy](const char* field, const std::string& value) {
        if (policy == VersionPolicy::Force) return true;
        if (policy == VersionPolicy::Never) return false;
        const std::string name(field);
        if (name == "SDK_INT" || name == "SDK_FULL") {
            if (rom.sdk == 0) return false;
            try { return std::stoi(value) <= rom.sdk; }
            catch (const std::exception&) { return false; }
        }
        if (name == "ANDROID_VERSION") return !rom.release.empty() && value == rom.release;
        if (name == "CODENAME") return !rom.codename.empty() && value == rom.codename;
        return false;
    };

    const std::string cfg_codename = device.value("CODENAME", "");
    if (!trim(cfg_codename).empty() && allowed("CODENAME", cfg_codename)) {
        info.version_codename = cfg_codename;
    }

    if (device.contains("ANDROID_VERSION")) {
        const std::string value = device["ANDROID_VERSION"].get<std::string>();
        if (allowed("ANDROID_VERSION", value)) info.android_version = value;
    }

    if (device.contains("SDK_INT")) {
        const std::string value = device["SDK_INT"].get<std::string>();
        if (allowed("SDK_INT", value)) {
            info.version_sdk_int = std::stoi(value);
            info.version_sdk = std::to_string(info.version_sdk_int);
        }
    }

    if (device.contains("SDK_FULL")) {
        const std::string value = device["SDK_FULL"].get<std::string>();
        if (allowed("SDK_FULL", value)) {
            const auto dot_position = value.find('.');
            const int major = std::stoi(dot_position == std::string::npos ? value : value.substr(0, dot_position));
            int minor = 0;
            if (dot_position != std::string::npos) {
                minor = std::stoi(value.substr(dot_position + 1));
            }
            info.version_sdk_int_full = major * 100000 + minor;
        }
    }
    if (!info.version_sdk_int_full && info.version_sdk_int) {
        info.version_sdk_int_full = info.version_sdk_int * 100000;
    }

    if (!info.version_codename.empty() || !info.android_version.empty()) {
        const std::string codename = info.version_codename.empty() ? rom.codename : info.version_codename;
        const std::string release = info.android_version.empty() ? rom.release : info.android_version;
        info.version_release_or_codename = releaseOrCodename(codename, release);
        info.version_release_or_preview_display = info.version_release_or_codename;
    }
    return info;
}

}  // namespace copgvd
