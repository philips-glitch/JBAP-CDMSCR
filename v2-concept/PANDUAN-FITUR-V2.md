# Panduan Fitur V2: CDMS Post-Auction "One Flow"

> Untuk siapa: Firman (dan tim internal LOGIQUE) supaya paham setiap fitur V2 sebelum dibahas dengan Yoshi-san, Alvin, dan JBAP.
> Pasangan dokumen ini: `README.md` (analisis, alasan, estimasi, workshop) dan `index.html` (scratch UI).
> Status: konsep, belum disetujui. Semua data di demo adalah dummy.

---

## 1. V2 dalam satu menit

V1 (prototype Philips) memindahkan form Access ke CDMS: setiap langkah adalah list, dan staf **mencentang** lalu **mengetik tanggal** supaya lot pindah ke list berikutnya.

V2 memakai CDMS dan menu yang sama (FAD / SMD / VWD tetap ada), tapi mengubah tiga hal:

| # | Ide | Artinya untuk user JBAP |
|---|---|---|
| 1 | **Tanggal tercatat dari kejadian, bukan diketik** | Awarding Date = saat BAAF terkirim, Buyer Paid = saat mutasi bank cocok, Seller Approved = saat seller klik link, dst. Mengetik tanggal hanya untuk koreksi. |
| 2 | **CDMS yang menyiapkan pekerjaan rutin** | Email SAAF, BAAF, reminder, DOAS, dan dispatch disiapkan sendiri dan dikirim pada **pengiriman terjadwal jam 16:00**. Staf tetap bisa Preview, Hold, atau Send now. |
| 3 | **Staf hanya melihat yang butuh keputusan** | Setiap departemen membuka **My Tasks**: daftar pengecualian (overdue, tidak cocok, perlu scan, perlu approve). Yang sedang menunggu pihak lain dipisah di tab sendiri. |

Hasilnya: 39 layar menjadi 20 (13 baru/berubah + 7 tetap seperti V1), 21 field tanggal yang diketik menjadi 0 di alur normal, dan 9 kolom centang "For …?" hilang.

---

## 2. Pola yang dipertahankan dari CDMS / V1

Supaya user JBAP tidak merasa memakai aplikasi baru, V2 sengaja memakai pola yang sudah mereka kenal:

| Pola V1 / CDMS | Di V2 |
|---|---|
| Sidebar CDMS MENU, menu FAD / SMD / VWD | Sama. Layar baru/berubah diberi tag hijau **V2**; yang tidak berubah ditandai *as V1* |
| Breadcrumb, judul, "Allowed actions" (View / Filter / Sort / Update), kalimat aturan di bawah judul | Sama di setiap layar |
| Kartu **Filter** biru + kartu list dengan **Show N entries**, header yang bisa di-sort, paging | Sama di semua list V2 |
| Tab di dalam satu menu (seperti Billing, Vehicle Dispatch di V1) | My Tasks punya tab: Tasks / Scheduled emails / Waiting on others |
| **Email preview** dengan From / To / Cc / Subject + tabel unit | Sama (Preview di Scheduled emails). Edit body dan Reset to standard text tetap seperti V1 |
| **Change date** dengan alasan wajib (Document Monitoring V1) | Diperluas: tersedia di setiap unit, untuk semua tanggal |
| **Cancel sale** di Result Price dengan Date Cancelled, Waived?, Justification | Field sama; bedanya fee langsung ditagih dan waiver masuk Approvals |
| Rebate diputuskan President di Approval | Sama, sekarang dalam satu inbox Approvals |
| **Log Activity** | Sama, ditambah kolom *Recorded* (Auto / Via link / 1-click / Scan / Typed) |
| Aturan bisnis V1: 3 hari kerja + holiday, penalty ₱500/hari, fee cancel ₱10.000, release condition per seller, DOAS per seller | Dipakai apa adanya |

---

## 3. Fitur satu per satu

Format tiap fitur: **apa**, **menggantikan apa di V1**, **cara kerja**, **coba di demo**, **yang perlu dikonfirmasi**.

### 3.1 My Tasks (FAD, SMD, VWD)

- **Apa**: satu layar kerja per departemen, isinya hanya yang butuh orang, urut dari paling mendesak (titik merah = tinggi, kuning = sedang, abu = rendah).
- **Menggantikan**: 
  - SMD: Pending Awarding, Unpaid, Seller Ack, For Dispatch (snapshot)
  - FAD: Pending Awarding, Unpaid, Payment Seller, Seller Acknowledgement, Vehicle Dispatch, Billing, Cancellation Billing
  - VWD: Unreleased Unit, Unreleased Unit (Overdue), For Dispatch
- **Cara kerja**: tiga tab.
  - **Tasks**: contoh isi:
    - SMD: buyer belum KYC lebih dari 2 hari kerja, seller belum approve SAAF lebih dari 2 hari kerja, unpaid lewat deadline (tombol **Cancel sale** / **Request +2 days**)
    - FAD: pembayaran bank tidak cocok, settlement run siap, DOAS/dokumen fisik untuk di-scan, serah dokumen ke buyer
    - VWD: unit siap pull-out / overdue (tombol **Release vehicle**)
  - **Scheduled emails**: lihat 3.2.
  - **Waiting on others**: lot yang sedang menunggu buyer, seller, President, atau pengiriman terjadwal. Tidak perlu tindakan; CDMS yang mengingatkan.
- **Coba**: FAD › My Tasks. Lalu Payment › Bank Transfer › Import, kembali ke FAD › My Tasks: muncul "Bank payment does not match".
- **Konfirmasi**: ambang "2 hari kerja" untuk eskalasi KYC/SAAF (usulan saya).

### 3.2 Scheduled emails (pengiriman terjadwal 16:00)

- **Apa**: semua email rutin disiapkan CDMS begitu syaratnya terpenuhi, lalu dikirim sekaligus pada jam cut-off.
- **Menggantikan**: kolom centang For SAAF, For BAAF, For Dispatch Email?, For DOAS Email? dan tombol Email … di V1.
- **Cara kerja**:

  | Email | Disiapkan saat | Tab |
  |---|---|---|
  | SAAF | KYC buyer approved | SMD |
  | Payment reminder | 1 hari kerja sebelum deadline bayar | SMD |
  | BAAF | Seller approve SAAF (ditahan otomatis kalau rebate masih menunggu President) | FAD |
  | DOAS for signature / EWB signing notice | Buyer sudah bayar (seller yang memakai DOAS) | FAD |
  | Vehicle dispatch notice | Syarat release seller terpenuhi | FAD |

  Per email: **Preview** (layout V1), **Hold** (alasan wajib), **Release hold**, **Send now**. Ada juga **Send all now**. Tanggal di lot (mis. Awarding Date) = tanggal email benar-benar terkirim.
- **Kenapa ada jeda sampai 16:00**: memberi waktu SMD untuk request rebate atau hold sebelum BAAF keluar, dan staf tetap memegang kontrol seperti di V1. Bedanya, kalau tidak ada masalah, staf tidak perlu melakukan apa pun.
- **Coba**: FAD › My Tasks › Scheduled emails. BAAF lot XAA1003 berstatus *Held: Rebate waiting for the President*. Approve rebate-nya di Approval › Approvals, lalu kembali: statusnya menjadi *Scheduled 4:00 PM*.
- **Konfirmasi**: jam cut-off; apakah BAAF digabung satu email per buyer seperti V1 (di demo satu email per lot supaya sederhana).

### 3.3 Unit page (halaman per lot)

- **Apa**: satu halaman berisi semua tentang satu lot. Dibuka dengan klik **plat nomor** di list mana pun.
- **Menggantikan**: mencari lot di banyak list FAD/SMD/VWD (satu lot di V1 bisa muncul di sampai 9 list).
- **Isi**:
  - Next action, beserta tombolnya.
  - Email yang terjadwal untuk lot ini.
  - Siapa yang sedang ditunggu.
  - Timeline *Sale → payment*.
  - Tiga track paralel setelah bayar: *Seller settlement*, *Documents*, *Release*.
  - Uang: harga, fee, rebate, total buyer, komisi, payable to seller.
  - History, beserta sumber setiap tanggal.
  - Tombol Change date.
- **Coba**: klik plat **XAA1007**.
- **Konfirmasi**: tidak ada; ini murni tampilan dari data yang sama.

### 3.4 Approvals (satu inbox)

- **Apa**: semua persetujuan di satu tempat: Rebate dan Fee waiver (President), Payment deadline extension (FAD Manager), dan nantinya Return to Seller (SMD/FAD Manager).
- **Menggantikan**: Approval › Rebate Approval, tanggal "SMD/FAD Manager Approved" yang diketik, dan teks "Approved by (FAD Manager)" di Extend.
- **Cara kerja**: tombol **Approve** / **Reject** (Reject wajib alasan). User dan tanggal tercatat otomatis. Efeknya langsung jalan:
  - Rebate approved: BAAF lepas dari hold.
  - Extension approved: deadline bertambah 2 hari kerja.
  - Waiver approved: fee menjadi 0.
- **Coba**: Approval › Approvals › Approve rebate XAA1003.
- **Konfirmasi**: siapa approver untuk tiap jenis; batas maksimal extension.

### 3.5 Payment › Bank Transfer (pencocokan otomatis)

- **Apa**: memakai modul CDMS yang **sudah ada** (import CSV mutasi bank), ditambah pencocokan otomatis.
- **Menggantikan**: mengetik Buyer Paid di FAD › Unpaid, Date Paid di Cancellation Billing, dan Payment Date di Unpaid Billing.
- **Cara kerja**: BAAF mencantumkan referensi pembayaran `BuyerID-Auction-Lot`. Saat file bank diimport, kredit yang cocok (referensi + jumlah) langsung menandai lot *Paid*. Yang tidak cocok (kurang bayar, tanpa referensi) masuk FAD › My Tasks dengan tombol **Accept & match** / **Ask buyer for balance**. Fee cancel juga dicocokkan dengan cara yang sama.
- **Coba**: Payment › Bank Transfer › Import bank statement: 2 lot cocok, 1 kurang bayar, 1 fee cancel lunas.
- **Konfirmasi (penting)**: apakah JBAP PH memakai modul ini sekarang; bank apa dan format file-nya; apakah buyer bisa diminta mencantumkan referensi. Kalau tidak bisa, fallback-nya FAD mencocokkan per baris (tetap lebih cepat daripada mengetik tanggal).

### 3.6 FAD › Settlement Run

- **Apa**: pembayaran ke seller dan commission billing dalam satu langkah.
- **Menggantikan**: Payment Seller (centang Print → ketik tanggal → print) dan Billing › Commission Billing (centang → ketik NOAH no. → print).
- **Cara kerja**: lot yang sudah dibayar buyer otomatis dikelompokkan per seller, semua angka dihitung dengan rumus V1 (komisi, VAT, transfer fee, payable). Satu tombol **Approve run** sekaligus:
  - mencatat Payment to Seller
  - membuat commission billing per seller
  - mengirim link *Acknowledge* ke seller
- **Coba**: FAD › Settlement Run › Approve run.
- **Konfirmasi**: integrasi NOAH (bisa tetap ketik nomor di fase awal); apakah semua seller dibayar dalam satu run harian.

### 3.7 FAD › Documents

- **Apa**: Document Monitoring dengan langkah dan status yang sama (Pending DOAS → Pending Documents → For Releasing → Complete), tapi tanpa mengetik tanggal.
- **Cara kerja**:

  | Tanggal V1 | Di V2 tercatat dari |
  |---|---|
  | Receipt of DOAS | Email DOAS for signature terkirim |
  | JBAP / Seller Receipt of Signed DOAS | **Scan** QR di transmittal saat dokumen fisik diterima (EWB: EWB konfirmasi lewat link) |
  | JBAP Receipt of Documents | **Scan** saat paket dokumen seller diterima |
  | Buyer Receipt of Documents | Saat unit di-release (diserahkan bersama), atau tombol *Mark handed over* |

- **Coba**: FAD › Documents › tombol **Scan** di kolom Signed DOAS.
- **Konfirmasi**: label QR di transmittal, dan alat scan (scanner atau kamera HP).

### 3.8 Auction › Result Price (layar CDMS existing)

- **Berubah**:
  - **KYC Status** dibaca dari KYC buyer di portal, tidak di-switch manual.
  - **Request rebate** otomatis menahan BAAF.
  - **Cancel sale** langsung menagih fee lewat email.
- **Tetap**: kolom dan layout CDMS seperti V1.
- **Konfirmasi**: sumber dan definisi "KYC approved" di jbap-revamp/API.

### 3.9 VWD › Release vehicle

- **Apa**: release unit sekaligus menagih storage penalty di langkah yang sama (diposting ke Cashier).
- **Menggantikan**: FAD › Unreleased Unit › Record payment lalu VWD › Release vehicle (dua layar, dua departemen).
- **Aturan tetap**: diblok kalau signed DOAS belum diterima.
- **Usulan perubahan aturan (perlu konfirmasi)**: untuk seller yang release-nya butuh DOAS, pull-out deadline baru dimulai setelah signed DOAS diterima, supaya buyer tidak kena penalty karena menunggu DOAS.

### 3.10 Report › Pipeline

- **Apa**: posisi semua unit per tahap, KPI (unpaid lewat deadline, penalty berjalan, piutang buyer, rata-rata hari kerja dari sale sampai release), dan daftar semua unit.
- **Report formal** (Rebate Monitoring, Liability to Seller, Inventory Summary, Cancellation Monitoring) tetap seperti V1.

### 3.11 Customer Inquiry dan buyer portal

- Halaman customer membaca stage yang sama dengan unit. Artinya Transaction History di buyer portal (V2/V3 untuk Joel) bisa memakai sumber data yang sama, tanpa logika terpisah.

### 3.12 Change date dan Log Activity

- **Change date** di setiap unit: pilih field, tanggal baru, alasan wajib. Divalidasi (tidak di masa depan, tidak sebelum langkah sebelumnya) dan dicatat old → new.
- **Log Activity**: setiap kejadian otomatis dan manual, dengan User, Module, Record, dan **Recorded**:
  - **Auto**: dicatat oleh CDMS
  - **Via link**: dari seller/buyer
  - **1-click**: tombol oleh staf
  - **Scan**: dokumen fisik
  - **Typed (correction)**: koreksi manual

---

## 4. Kenapa V2 menjawab arahan yang kita terima

| Arahan | Jawaban V2 |
|---|---|
| Kaneshima-san: requirement tidak boleh sekadar memindahkan Access ke CDMS | Alur tidak lagi "list → centang → ketik tanggal → pindah list"; satu unit bergerak sendiri berdasarkan kejadian |
| Notes internal: fitur terlalu banyak | 39 → 20 layar; list duplikat SMD dihapus; 7 list FAD digabung ke My Tasks |
| Notes internal: input masih manual, harusnya auto-calculate / autofill | 21 tanggal yang diketik → 0 di alur normal; angka settlement dihitung; email disiapkan sendiri |
| Notes internal: satu kesatuan flow, bukan fitur satu-satu | Unit page + tiga track paralel; semua layar membaca state yang sama |
| Pola kerja JBAP yang sudah ada | Menu, komponen, email layout, aturan bisnis, Change date, Log Activity tetap (bagian 2) |

**Untuk pembahasan internal dengan Alvin (usulan, belum dibahas dengan beliau)**: V2 bisa dipecah menjadi fase supaya estimasi terkendali.
1. Core state per unit + My Tasks + Unit page + Scheduled emails + Approvals.
2. Bank matching + link seller/buyer.
3. NOAH + QR scan.

Setiap fase tetap bisa dipakai walau fase berikutnya belum jalan (fallback 1-click).

---

## 5. Skenario demo 10 menit

1. **Home**: kartu SMD / FAD / VWD / Approval dengan jumlah tugas.
2. **FAD › My Tasks**: hanya pengecualian. Buka tab *Waiting on others* untuk lihat yang tidak perlu disentuh.
3. Klik plat **XAA1007**: Unit page, overdue pull-out, penalty berjalan.
4. **Payment › Bank Transfer › Import**: pembayaran cocok sendiri, satu masuk My Tasks.
5. **FAD › My Tasks › Scheduled emails**: BAAF XAA1003 ditahan karena rebate. **Preview** email-nya.
6. **Approval › Approvals › Approve** rebate: BAAF berubah jadi *Scheduled 4:00 PM*.
7. **FAD › Settlement Run › Approve run**: payment to seller + commission billing tercatat.
8. **VWD › My Tasks › Release vehicle**: penalty ditagih sekaligus.
9. **Demo events › Next working day**: email terkirim pada 16:00, reminder dan penalty bergerak.
10. **Log Activity**: semua kejadian dengan kolom *Recorded*. Tutup dengan **V1 vs V2** di header.

---

## 6. Pertanyaan yang mungkin muncul dari JBAP

| Pertanyaan | Jawaban singkat |
|---|---|
| Kalau email otomatis salah? | Email tidak langsung keluar: ditahan sampai 16:00, bisa di-Preview dan di-Hold. Isinya bisa diedit seperti V1. |
| Kalau seller tidak mau klik link? | SMD bisa **Record approval** dengan bukti (1-click, user dan tanggal tercatat). |
| Kalau buyer transfer tanpa referensi? | Masuk FAD › My Tasks untuk dicocokkan manual (1-click), bukan mengetik tanggal. |
| Kalau tanggal yang tercatat salah? | Change date dengan alasan, tercatat di Log Activity. |
| Apakah report Access hilang? | Report formal tetap (bagian 3.10). Pipeline menggantikan list harian. |
| Apakah aturan (deadline, penalty, fee) berubah? | Tidak, kecuali usulan pull-out deadline seller DOAS (3.9) yang perlu persetujuan JBAP. |

---

## 7. Belum ada di scratch UI

- Return to Seller dan Security Bond: tetap *as V1*, approval-nya nanti pindah ke Approvals.
- Gabung email per buyer (V1 mengirim satu email per buyer).
- Halaman konfirmasi untuk seller/buyer saat klik link.
- Layout print (Payment Seller report, billing, transmittal): tetap layout V1.
- Login dan role: demo memakai nama user contoh (smd.user, fad.user, vwd.user, president, fad.manager).
