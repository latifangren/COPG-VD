# Rencana Audit Lanjutan dan Peningkatan COPG-VD

## Goal

Meningkatkan keandalan, kemudahan pemeliharaan, kejelasan diagnosis, dan pengalaman penggunaan COPG-VD tanpa mengubah perilaku spoofing secara tidak sengaja. Perubahan dibagi per fase dengan gerbang validasi sebelum berpindah ke fase yang lebih berisiko.

## Success Criteria

- Perilaku kontrak konfigurasi dan nilai yang diterapkan konsisten antara updater, shell, Zygisk, dan WebUI.
- Perubahan pada konfigurasi gagal dengan aman: file lama tetap utuh, backup tersedia, serta alasan kegagalan terlihat.
- Tes otomatis berjalan pada pull request untuk kode yang dapat diuji tanpa perangkat; build mencakup ABI yang didukung.
- Modul shell, C++, Python, dan WebUI memiliki batas tanggung jawab yang jelas tanpa memperbesar ketergantungan runtime Android secara tidak perlu.
- Fitur tambahan hanya dirilis setelah kebutuhan, format konfigurasi, kompatibilitas, risiko, dan jalur rollback disepakati serta diuji.
- Tidak ada klaim peningkatan performa tanpa pengukuran pembanding.

## Approach

Lakukan perubahan secara bertahap: tetapkan kontrak dan baseline terlebih dahulu, perbaiki alur konfigurasi, bangun pengujian, lalu modularisasi tiap subsistem. Setiap fase harus menjaga kompatibilitas format `COPG-VD.json` atau menyediakan migrasi yang teruji. Optimasi hanya dilakukan jika profiling menunjukkan biaya yang layak diperbaiki.

Rujukan lokal utama: `module/fingerprint-update.sh`, `module/service.sh`, `module/customize.sh`, `zygisk/spoof_module.cpp`, `zygisk/atexit.cpp`, `zygisk/CMakeLists.txt`, `module/webroot/scripts.js`, `module/webroot/i18n.js`, `.github/scripts/update_copg_json.py`, `.github/workflows/COPG-VD.yml`, dan `.github/workflows/update-json.yml`.

## Phases

### Phase 0 — Baseline, kontrak, dan inventaris perilaku

**Tujuan:** dokumentasikan perilaku saat ini dan pisahkan temuan terverifikasi dari hipotesis audit.

**Pekerjaan:**

- Petakan alur instalasi, boot, resetprop, hooking `android.os.Build`, update otomatis/manual, backup/restore, analisis konfigurasi, logcat, dan bahasa UI.
- Inventaris semua key konfigurasi: pembaca, penulis, default, validasi, target property/field Java, serta aturan versi.
- Catat kontrak updater: mode, status output, exit code, lokasi config/state/log/backup, semantik update ke depan, dan perlakuan terhadap profil perangkat khusus.
- Catat kompatibilitas Magisk/KernelSU/APatch, Android API minimum, ABI, batas shell/awk/busybox, serta WebView yang didukung berdasarkan workflow dan dokumentasi proyek yang tersedia.
- Verifikasi tiap temuan audit terhadap caller dan kode; klasifikasikan sebagai bug terkonfirmasi, risiko, optimasi yang perlu diukur, atau ide fitur.
- Buat diagram arsitektur/alur data dan catatan keputusan teknis di dokumentasi proyek.

**Gerbang selesai:** setiap key dan alur penting punya sumber kebenaran serta perilaku yang diharapkan; isu yang tidak terbukti tidak dimasukkan sebagai fakta atau perubahan wajib.

### Phase 1 — Uji regresi dan validasi konfigurasi

**Tujuan:** pasang pagar agar refactor berikutnya tidak mengubah perilaku diam-diam.

**Pekerjaan:**

- Tambahkan tes Python untuk parsing props, ZIP/range edge cases yang dapat diuji dengan fixture lokal, ekstraksi/mapping props, preservasi urutan dan key duplikat, render JSON, mode check-only, serta penolakan downgrade.
- Tambahkan tes shell untuk parsing/validasi nilai, keputusan versi `never`/`rom`/`force`, pengelolaan target ganda, backup, kegagalan tulis, dan status mode CLI dengan utilitas tiruan.
- Tambahkan tes C++ untuk pemetaan data JSON ke `DeviceInfo`, nilai timestamp/SDK, versi ROM yang tidak tersedia atau malformed, dan aturan `release_or_codename`; pisahkan logika murni JNI bila diperlukan agar dapat diuji host-side.
- Tambahkan tes WebUI untuk quoting shell, escaping/sanitasi konten, output status updater, konfigurasi save/restore, nama file, serta error/timeout API.
- Tetapkan test runner per lingkungan yang paling kecil dan sesuai dengan dependency yang sudah dipakai; jangan menambah framework besar tanpa kebutuhan.
- Tambahkan validasi konsistensi key terjemahan dan pemeriksaan syntax/format yang dipilih proyek.

**Gerbang selesai:** tes negatif dan edge case lulus; fixture tidak mengandalkan jaringan; hasil build/test dapat direproduksi di CI.

### Phase 2 — Kontrak konfigurasi dan keselamatan updater

**Tujuan:** satu kontrak yang eksplisit dari sumber data hingga properti sistem dan Java Build.

**Pekerjaan:**

- Buat spesifikasi/schema key yang mencatat tipe string, optionality, validasi, sumber, dan target. Awali sebagai spesifikasi untuk tes; baru jadikan generator bila pengurangan duplikasi terbukti aman.
- Bandingkan `KNOWN_KEYS`, `get_prop_mapping`, `PROP_MAP`, pembaca C++, dan field WebUI. Putuskan secara eksplisit apakah `ODM_SKU`/`SKU` dan setiap key lain didukung di semua lapisan atau hanya di lapisan tertentu.
- Periksa key seperti `UUID` dan `SDK_FINGERPRINT`: tentukan target property berdasarkan kontrak aktual Android/proyek; jangan menambah pemetaan hanya demi simetri tanpa bukti bahwa target dibutuhkan.
- Ganti parsing JSON berbasis grep/sed pada jalur runtime secara bertahap dengan parser yang tersedia di perangkat atau helper yang telah dibundel dan dapat diuji. Jangan mengasumsikan Python ada pada perangkat.
- Pertahankan parser updater yang dapat menjaga konten kustom dan format pengguna; validasi hasil penuh sebelum mengganti file.
- Terapkan tulis atomik melalui file sementara pada direktori yang sama, cek hasil tulis, jaga mode/SELinux context, dan pertahankan `.bak`; kegagalan salah satu target harus dilaporkan tanpa menyatakan seluruh update sukses.
- Perkeras validasi remote: struktur JSON, tipe dan pola nilai, identitas perangkat, perbandingan versi build, serta respons HTTP/Range yang tidak sesuai.
- Tentukan format status CLI stabil yang mudah diparse WebUI, termasuk kegagalan jaringan, tidak ada config, konfigurasi rusak, profile berbeda, dan versi lokal lebih baru.

**Gerbang selesai:** tes membuktikan bahwa config valid dipertahankan, nilai malformed/downgrade ditolak, kegagalan tidak merusak file lama, dan status sukses hanya muncul bila penulisan yang diwajibkan benar-benar selesai.

### Phase 3 — Shell boot/runtime dan instalasi

**Tujuan:** buat alur boot dan instalasi lebih mudah ditinjau serta kuat pada varian root manager.

**Pekerjaan:**

- Pisahkan fungsi di `fingerprint-update.sh` berdasarkan domain (log/status, IO konfigurasi, validasi, versi ROM, write/migration, analisis, download, dispatch). Pertahankan entry point, argumen, dan status yang ada.
- Pisahkan `service.sh` menjadi operasi membaca ROM, kebijakan versi, mapping prop, penerapan prop, update post-boot. Tentukan apakah file library terpisah benar-benar aman untuk cara modul dipaketkan dan dipanggil.
- Pertahankan eksekusi updater otomatis di latar belakang dan jangan menahan boot; uji perilaku retry, batas waktu, state per boot, jaringan tidak tersedia, dan penghentian/duplikasi proses.
- Periksa `date -d`, `stat`, `pidof`, `chcon`, `timeout`, `awk`, dan `wget` terhadap utilitas yang dijamin pada target. Tambahkan fallback hanya untuk kemampuan yang perlu didukung dan dapat dites.
- Perbaiki penanganan sinyal, temporary file, cleanup, exit status, quoting, serta nama/path file conformance.
- Tinjau installer: deteksi konflik, input tombol/timeout, migrasi versi Android, izin file, direktori sysconfig, upgrade, dan uninstall yang mempertahankan config pengguna.
- Hapus duplikasi atau helper hanya setelah caller dan kompatibilitas upgrade diverifikasi.

**Gerbang selesai:** tes shell berjalan pada shell POSIX yang relevan; simulasi mode sukses/gagal tidak menulis di luar fixture; uji perangkat membuktikan boot tidak tertahan dan config lama tetap aman.

### Phase 4 — Modul Zygisk C++

**Tujuan:** sederhanakan parsing dan penerapan spoof tanpa menambah risiko di proses zygote.

**Pekerjaan:**

- Pecah `spoofDevice()` menjadi fungsi kecil untuk membaca/validasi config, evaluasi kebijakan versi, pemetaan `DeviceInfo`, pencarian field JNI, dan penerapan field Build.
- Tangani tipe JSON salah, string/nilai terlalu besar, timestamp invalid/overflow, SDK malformed, config tidak tersedia, field JNI tidak ada, dan exception JNI dengan perilaku eksplisit.
- Hindari membaca seluruh object JSON berulang atau menyalin data bila referensi cukup; ukur sebelum optimasi yang mengubah jalur startup.
- Tambahkan log ringkas yang dapat membantu diagnosis tanpa membanjiri logcat atau membocorkan data yang tidak perlu.
- Verifikasi kebutuhan `atexit.cpp` melalui konfigurasi linker, simbol library hasil build, ABI yang dituju, dan uji load/unload yang sesuai; hapus atau ubah hanya jika bukti menunjukkan aman.
- Jangan menambah field spoof, termasuk serial/ABI, hanya atas dugaan pemeriksa tertentu membacanya; perlukan kontrak fitur dan uji terpisah.

**Gerbang selesai:** semua ABI didukung berhasil dibangun; tes parsing/transformasi lulus; uji pada perangkat/emulator menunjukkan nilai Java yang diminta konsisten dengan property yang diminta sesuai kebijakan.

### Phase 5 — Modularisasi dan perbaikan WebUI

**Tujuan:** mengurangi coupling pada `scripts.js` sekaligus mempertahankan dukungan WebView dan API root manager.

**Pekerjaan:**

- Kelompokkan modul berdasarkan tanggung jawab: command bridge, config/state, settings/updater, device editor, logs, backup/file picker, informasi/lisensi, dan i18n.
- Pilih modul ES native atau bundling setelah memverifikasi dukungan WebView/KsuWebUIStandalone dan cara aset disajikan; pertahankan fallback yang dibutuhkan. Jangan memilih bundler sebelum batas dukungan runtime jelas.
- Jadikan `execCommand` satu wrapper teruji: callback unik, pembersihan callback pada seluruh jalur, penanganan API tidak tersedia, timeout yang sesuai untuk perintah panjang, dan pembedaan error/exit code.
- Pastikan seluruh nilai dinamis yang masuk ke perintah shell di-quote; minimalkan perintah shell berantai dan jangan memasukkan nama file ke HTML tanpa text node/escaping.
- Perbaiki polling logcat agar tidak menjalankan loop terlalu rapat, tidak menghapus log sistem yang bukan milik UI, mempunyai batas tampilan/log yang jelas, dan dapat dihentikan tanpa callback menggantung.
- Tinjau file picker: parsing nama file dengan spasi/baris baru, scope pencarian, batas hasil, penanganan izin, path restore yang diizinkan, dan race saat pencarian lama selesai belakangan.
- Tinjau update config: tulis atomik/validasi, proteksi dari state parsial, konsistensi antara data JSON dan flag, serta proses/package yang dihentikan setelah update. Selaraskan daftar package antara WebUI dan updater berdasarkan keputusan produk yang terdokumentasi.
- Ganti sanitasi Markdown ad hoc hanya jika uji menunjukkan celah atau pemeliharaannya rapuh; evaluasi library yang dibundel terhadap CSP, ukuran paket, lisensi, dan WebView.
- Validasi semua locale terhadap key Inggris dan interpolasi; tampilkan fallback bahasa dengan jelas bila terjemahan tidak lengkap.
- Optimasi render/log (mis. pembatasan jumlah entri) berdasarkan profiling, bukan klaim persentase sebelum benchmark.

**Gerbang selesai:** tes logika UI lulus; audit semua perintah root dan jalur input dinamis tuntas; uji manual melalui WebUI nyata pada root manager yang didukung mencakup settings, updater/analyze, edit config, backup/restore, picker, dan logcat.

### Phase 6 — CI, build, dan dokumentasi kontributor

**Tujuan:** menangkap masalah lebih awal dan membuat build rilis konsisten.

**Pekerjaan:**

- Tambahkan workflow pull request untuk tes Python/shell/JS yang tidak membutuhkan perangkat, validasi JSON/locale, serta build Zygisk untuk setiap ABI yang didukung.
- Gunakan versi toolchain yang dipatok dan cache hanya untuk komponen yang aman serta benar-benar mengurangi waktu. Ukur durasi sebelum/sesudah; jangan mengandalkan klaim penghematan tanpa hasil.
- Verifikasi paket akhir berisi script executable, library ABI yang benar, WebUI/README/lisensi, config contoh, metadata versi/update, dan tidak berisi file build sementara.
- Tambahkan pemeriksaan bahwa versi, versionCode, update metadata, changelog, dan nama artefak konsisten; pertahankan aturan single source of truth yang sudah ada di `module/module.prop` dan `.github/scripts/version.sh`.
- Tinjau permission token Actions, pinning action, input workflow_dispatch, upload artifact, dan dispatch workflow release. Perubahan yang mengubah publikasi tetap memerlukan jalur rilis yang eksplisit.
- Tulis `docs/architecture.md`, `docs/config-schema.md`, `docs/testing.md`, dan `CONTRIBUTING.md` hanya dengan kontrak yang sudah diverifikasi; jelaskan cara menambah key, locale, ABI, dan perubahan format.

**Gerbang selesai:** seluruh gate CI lulus dari pull request; artefak zip diperiksa; tidak ada klaim rilis sampai receipt/artifact dari workflow tersedia.

### Phase 7 — Evaluasi fitur tambahan dan optimasi berbasis data

**Tujuan:** pilih fitur yang memberi manfaat jelas tanpa memperbesar permukaan risiko secara tak terkendali.

**Kandidat untuk evaluasi:**

- **Diagnostics UI:** ringkasan status config/parser, policy versi ROM, prop yang terbaca, updater terakhir, dan kegagalan terkait. Mulai dari status yang memang dapat diverifikasi; jangan melaporkan “sehat” saat data tidak tersedia.
- **Import/export profil:** validasi file sebelum restore, preview perubahan, backup otomatis, dan rollback. Pertahankan format config yang sudah dipakai.
- **Beberapa profil lokal:** definisikan format, migrasi, dan tindakan pemilihan global terlebih dahulu. Pemilihan per-app adalah perubahan arsitektur dan kompatibilitas tersendiri, bukan bagian otomatis dari fitur profil dasar.
- **Log terstruktur:** evaluasi format yang mudah diparse dan rotasi ukuran sebelum menambah file log baru.
- **Fingerprint freshness/metadata:** tampilkan provenance, build id, patch, dan waktu sumber yang berhasil diambil; jangan menganggap pembandingan terhadap layanan eksternal sebagai validasi autentik tanpa sumber dan semantik yang jelas.
- **Optimasi:** ukur waktu boot yang diatribusikan ke modul, durasi updater, penggunaan CPU/memori WebUI, ukuran paket, dan waktu build CI. Optimasi hanya jika metrik baseline dan target disepakati.

**Tidak termasuk sampai ada kebutuhan dan desain terpisah:** integrasi cloud, pengubahan/peniruan per-app, interaksi langsung dengan TEE/KeyMint, auto-revert berbasis hasil attestation, serta klaim bahwa fitur tertentu meningkatkan kelulusan pemeriksaan integritas.

**Gerbang selesai:** setiap fitur terpilih memiliki kontrak UI/config, migrasi/rollback, analisis izin dan privasi, tes, serta kriteria penerimaan yang dapat diamati. Kandidat yang belum dipilih tetap backlog.

## Validation Plan

Jalankan setiap gate yang telah dikonfigurasi repo dan tes relevan tanpa mengecualikan kasus gagal. Saat ini belum ditemukan direktori tes standar atau konfigurasi test runner pada pemeriksaan awal; Phase 1 menetapkan dan mendokumentasikan runner sebelum gate baru diwajibkan.

- **Python:** uji unit offline memakai fixture, lalu simulasi respons/range yang malformed; tidak mengunduh factory image dalam tes rutin.
- **Shell:** `sh -n` untuk setiap script yang disentuh dan harness fixture/mocks untuk status, rollback, target config ganda, nilai malformed, dan kasus utilitas hilang.
- **C++:** build CMake/NDK release untuk arm64-v8a, armeabi-v7a, x86_64; cek simbol/dependency artefak dan jalankan tes host-side untuk logika murni.
- **WebUI:** syntax/lint dan tes logika tanpa perangkat, dilanjut uji melalui WebView/root manager sesungguhnya untuk seluruh kontrol utama dan hasil sukses/gagal.
- **Integrasi Android:** install/upgrade/uninstall pada perangkat uji; verifikasi boot selesai, resetprop sesuai toggle, Java Build sesuai config/policy, update tidak menimpa key kustom, backup pulih, serta kegagalan jaringan/config tercermin sebagai status gagal.
- **CI/package:** jalankan workflow pull request, inspeksi isi zip, permission file, library per ABI, dan konsistensi metadata. Rilis/publikasi diuji melalui workflow yang ditujukan untuk itu, bukan lewat simulasi lokal saja.
- **Performa:** rekam baseline dan kandidat pada perangkat/build yang sama dengan beberapa pengulangan; laporkan median dan variasi, lalu pertahankan optimasi hanya jika dampaknya terukur dan tidak merusak perilaku.

Urutan gate risiko tertinggi: validasi tulis config dan migrasi, perubahan shell boot, serta perubahan C++ yang dieksekusi di zygote. Gate tersebut memerlukan tes negatif dan uji perangkat sebelum rilis.

## Risks and Rollback

- **Config rusak atau hilang:** tulis atomik, backup sebelum migrasi, uji rollback dari `.bak`, dan jangan hapus key tidak dikenal saat round-trip kecuali migrasi secara eksplisit menyatakan demikian.
- **Perbedaan lingkungan Android:** jangan mengandalkan utilitas desktop; validasi di shell/perangkat yang mewakili Magisk, KernelSU, dan APatch sesuai dukungan yang benar-benar dinyatakan.
- **Perilaku spoof berubah saat refactor:** bekukan kontrak dengan fixture dan perbandingan output sebelum memecah modul; perubahan perilaku hanya lewat perubahan terpisah dengan tes dan catatan changelog.
- **Perubahan WebUI berisiko karena bridge root:** minimalkan command surface, quote semua input, uji sumber konten yang tidak tepercaya, dan tinjau kompatibilitas CSP/WebView.
- **Fitur/profil menambah format config:** sediakan pembacaan format lama, migrasi idempotent, backup, dan versi schema bila diperlukan.
- **Toolchain/cache menimbulkan build tak reproduktif:** pin versi, verifikasi artefak bersih, dan fallback ke build tanpa cache.
- **Batas validasi:** verifikasi host/CI tidak menggantikan uji perangkat nyata untuk boot, JNI, SELinux, dan root-manager bridge. Hasil yang belum diuji di perangkat harus ditandai belum terverifikasi.

## Open Questions

- Tidak ada pertanyaan yang menghalangi penulisan rencana. Sebelum Phase 7 dijalankan, pilih kandidat fitur dan urutannya berdasarkan kebutuhan pengguna; rencana ini tidak menganggap semua kandidat wajib dibangun.
