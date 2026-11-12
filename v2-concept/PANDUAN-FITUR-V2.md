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
| 1 | **Tanggal tercatat dari kejadian, bukan diketik** | Awarding Date = saat BAAF terkirim, Buyer Paid = saat mutasi bank cocok, Seller Approved = saat SMD mencatat SAAF bertanda tangan kembali (sekali per form), dst. Mengetik tanggal hanya untuk koreksi. |
| 2 | **CDMS yang menyiapkan pekerjaan rutin** | SAAF disusun sendiri per seller per auction (siap print). Email BAAF, reminder, DOAS, dan dispatch disiapkan sendiri dan dikirim pada **pengiriman terjadwal jam 16:00**. Staf tetap bisa Preview, Hold, atau Send now. |
| 3 | **Staf hanya melihat yang butuh keputusan** | Setiap departemen membuka **My Tasks**: daftar pengecualian (overdue, tidak cocok, perlu scan, perlu approve). Yang sedang menunggu pihak lain dipisah di tab sendiri. |

> **Prinsip penting (masukan Calvin, 12 Nov):** seller dan buyer **tidak pernah membuka CDMS**. Link CDMS tidak diekspos ke luar. Semua yang datang dari seller (SAAF bertanda tangan, acknowledgement pembayaran, konfirmasi DOAS EWB) **dicatat oleh user CDMS**, cukup satu klik per dokumen, bukan mengetik tanggal per lot. KYC buyer tetap dibaca dari buyer portal (sistem terpisah, bukan CDMS).

Hasilnya: 39 layar menjadi 21 (14 baru/berubah + 7 tetap seperti V1), 21 field tanggal yang diketik menjadi 0 di alur normal, dan 9 kolom centang "For …?" hilang.

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
| **Log Activity** | Sama, ditambah kolom *Recorded* (Auto / 1-click / Scan / Typed) |
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
    - SMD: buyer belum KYC lebih dari 2 hari kerja, SAAF siap print dan kirim, SAAF bertanda tangan belum kembali lebih dari 2 hari kerja, seller tidak tanda tangan untuk suatu lot, unpaid lewat deadline (tombol **Cancel sale** / **Request +2 days**)
    - FAD: pembayaran bank tidak cocok, settlement run siap, DOAS/dokumen fisik untuk di-scan, serah dokumen ke buyer
    - VWD: unit siap pull-out / overdue (tombol **Release vehicle**)
  - **Scheduled emails**: lihat 3.2.
  - **Waiting on others**: lot yang sedang menunggu buyer, seller, President, atau pengiriman terjadwal. Tidak perlu tindakan; CDMS yang mengingatkan.
- **Coba**: FAD › My Tasks. Lalu Payment › Bank Transfer › Import, kembali ke FAD › My Tasks: muncul "Bank payment does not match".
- **Konfirmasi**: ambang "2 hari kerja" untuk eskalasi KYC/SAAF (usulan saya).

### 3.2 Scheduled emails (pengiriman terjadwal 16:00)

- **Apa**: semua email rutin disiapkan CDMS begitu syaratnya terpenuhi, lalu dikirim sekaligus pada jam cut-off.
- **Menggantikan**: kolom centang For BAAF, For Dispatch Email?, For DOAS Email? dan tombol Email … di V1.
- **Cara kerja**:

  | Email | Disiapkan saat | Tab |
  |---|---|---|
  | Payment reminder | 1 hari kerja sebelum deadline bayar | SMD |
  | BAAF | SAAF bertanda tangan dicatat SMD (ditahan otomatis kalau rebate masih menunggu President) | FAD |
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
- **Import tetap seperti CDMS sekarang** (dicek di `jbap-cdms`, `BankTransferController`): pilih **Bank Name**, **Date**, file CSV, Show lalu Upload, dengan tombol **Download Template** yang sama (`template_btm.csv`, 5 kolom: *Last Name, First Name, Middle Name, Customer Account Number, Amount*). Template tidak perlu diubah.
- **Cara kerja**: bedanya hanya setelah Upload. Hari ini FAD meng-assign setiap baris secara manual di layar detail Bank Transfer. Di V2 CDMS meng-assign sendiri: **Customer Account Number** → buyer, **Amount** → lot yang ditagih (atau fee cancel). Yang cocok langsung menandai lot *Paid*. Yang tidak cocok (kurang bayar, nomor akun tidak dikenal, dua lot dengan jumlah sama) masuk FAD › My Tasks dengan tombol **Accept & match** / **Ask buyer for balance**. Fee cancel juga dicocokkan dengan cara yang sama.
- **Riwayat pembayaran (masukan Calvin, 12 Nov)**: setiap kredit dari semua file import **tersimpan** dan tampil di:
  - Payment › Bank Transfer › *Bank transactions (all imports)*: Payment ID, tanggal, Bank Name, Full Name, Customer Account No., jumlah, *Assign to* (tipe + lot), seller, tipe (Buyer payment / Balance / Cancellation fee), jumlah, hasil, dan siapa yang mencocokkan. Bisa difilter dan di-sort.
  - Unit page › Money: *Received …* per pembayaran.
  - Customer page: kolom *Paid*.
- **Coba**: Payment › Bank Transfer › Import bank statement: 2 lot cocok, 1 kurang bayar, 1 fee cancel lunas, dan semuanya masuk daftar bersama pembayaran sebelumnya.
- **Konfirmasi (penting)**: apakah JBAP PH memakai modul ini sekarang dan dengan template ini; *Customer Account Number* di file itu isinya apa (nomor rekening pengirim, virtual account, atau nomor customer JBAP) dan apakah tercatat di data customer; bagaimana kalau satu buyer membayar beberapa lot sekaligus (satu kredit untuk total). Kalau tidak bisa dicocokkan otomatis, fallback-nya FAD meng-assign per baris seperti sekarang.

### 3.6 FAD › Settlement Run

- **Apa**: pembayaran ke seller dan commission billing dalam satu langkah.
- **Menggantikan**: Payment Seller (centang Print → ketik tanggal → print) dan Billing › Commission Billing (centang → ketik NOAH no. → print).
- **Cara kerja**: lot yang sudah dibayar buyer otomatis dikelompokkan per seller, semua angka dihitung dengan rumus V1 (komisi, VAT, transfer fee, payable). Satu tombol **Approve run** sekaligus:
  - mencatat Payment to Seller
  - membuat commission billing per seller
  - mengirim payment advice ke seller. Acknowledgement bertanda tangan dari seller dicatat FAD lewat **FAD › My Tasks › Record acknowledgement** (satu kali per seller, centang lot yang ada di dokumen)
- **Coba**: FAD › Settlement Run › Approve run.
- **Konfirmasi**: integrasi NOAH (bisa tetap ketik nomor di fase awal); apakah semua seller dibayar dalam satu run harian.

### 3.7 FAD › Documents

- **Apa**: Document Monitoring dengan langkah dan status yang sama (Pending DOAS → Pending Documents → For Releasing → Complete), tapi tanpa mengetik tanggal.
- **Cara kerja**:

  | Tanggal V1 | Di V2 tercatat dari |
  |---|---|
  | Receipt of DOAS | Email DOAS for signature terkirim |
  | JBAP / Seller Receipt of Signed DOAS | **Scan** QR di transmittal saat dokumen fisik diterima (EWB: FAD klik *Record signed DOAS* saat EWB konfirmasi) |
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
  - **1-click**: tombol oleh staf
  - **Scan**: dokumen fisik
  - **Typed (correction)**: koreksi manual

### 3.13 SMD › SAAF (satu form per seller per auction)

- **Apa**: CDMS menyusun SAAF dengan layout yang sama dengan form kertas sekarang (Seller, Auction Number, daftar lot, Winning Bid Price, Buyer Name, JBAP Customer ID, kalimat release, tiga kolom tanda tangan), satu form per seller per auction, dari lot yang KYC buyer-nya sudah approved. Lot yang KYC-nya approved belakangan masuk form baru (SAAF susulan).
- **Menggantikan**: SMD › SAAF di V1 (centang For SAAF, kirim email, ketik Seller Approved **per lot**).
- **Cara kerja**:
  1. Form muncul di SMD › My Tasks: *SAAF A231 · EWB ready to check & print*. Tombol **Check & print** membuka form. SMD mengecek **winning bid price dan buyer** setiap lot (masukan Calvin), mencentang *Winning bid price and buyer checked for every lot*, lalu klik **Checked & print**: CDMS mencatat SMD sudah cek (user dan tanggal). Lot di bawah minimum bid hanya diberi catatan. Harga atau buyer yang salah dikoreksi di Auction › Result Price sebelum print. Ini menggantikan pengecekan SMD sebelum print yang sekarang tidak tercatat (masukan Calvin).
  2. Tanda tangan SMD head dan Finance & Admin Head tetap di kertas; CDMS tidak mencatat tanda tangannya, hanya langkah cek SMD di atas.
  3. SMD klik **Mark sent to seller**: tanggal *SAAF sent to seller* tercatat untuk semua lot di form.
  4. Seller tanda tangan di kertas. Saat kembali, SMD klik **Record signed SAAF**: semua lot tercentang; untick lot yang tidak ditandatangani seller; lampirkan scan. Tanggal *Seller signed SAAF* tercatat untuk lot yang dicentang, dan BAAF lot itu masuk antrean 16:00.
  5. Kalau lebih dari 2 hari kerja belum kembali: task *Signed SAAF … not back yet* dengan **Remind seller**.
- **Coba**: SMD › SAAF, atau SMD › My Tasks: Check & print SAAF A231 · EWB → Mark sent to seller → Record signed SAAF. Atau Demo events › *A seller returns a signed SAAF*.
- **Konfirmasi** (tanya ke Joel): bagaimana seller mengirim balik SAAF bertanda tangan (email scan, fisik, kurir) dan berapa lama biasanya; apakah cek SMD cukup winning bid price dan buyer (perkiraan Calvin); apakah perlu dicatat siapa yang tanda tangan internal (sekarang tidak); apakah QR di form bisa dipakai untuk mencatat saat kembali (scan, bukan klik).

---

## 4. Kenapa V2 menjawab arahan yang kita terima

| Arahan | Jawaban V2 |
|---|---|
| Kaneshima-san: requirement tidak boleh sekadar memindahkan Access ke CDMS | Alur tidak lagi "list → centang → ketik tanggal → pindah list"; satu unit bergerak sendiri berdasarkan kejadian |
| Notes internal: fitur terlalu banyak | 39 → 21 layar; list duplikat SMD dihapus; 7 list FAD digabung ke My Tasks |
| Notes internal: input masih manual, harusnya auto-calculate / autofill | 21 tanggal yang diketik → 0 di alur normal; angka settlement dihitung; email disiapkan sendiri |
| Notes internal: satu kesatuan flow, bukan fitur satu-satu | Unit page + tiga track paralel; semua layar membaca state yang sama |
| Pola kerja JBAP yang sudah ada | Menu, komponen, email layout, aturan bisnis, Change date, Log Activity tetap (bagian 2) |

**Untuk pembahasan internal dengan Alvin (usulan, belum dibahas dengan beliau)**: V2 bisa dipecah menjadi fase supaya estimasi terkendali.
1. Core state per unit + My Tasks + Unit page + Scheduled emails + Approvals.
2. Bank matching.
3. NOAH + QR scan.

Setiap fase tetap bisa dipakai walau fase berikutnya belum jalan (fallback 1-click).

---

## 5. Skenario demo 12 menit

1. **Home**: kartu SMD / FAD / VWD / Approval dengan jumlah tugas.
2. **FAD › My Tasks**: hanya pengecualian. Buka tab *Waiting on others* untuk lihat yang tidak perlu disentuh.
3. Klik plat **XAA1007**: Unit page, overdue pull-out, penalty berjalan.
4. **Payment › Bank Transfer › Import**: pembayaran cocok sendiri, satu masuk My Tasks.
5. **FAD › My Tasks › Scheduled emails**: BAAF XAA1003 ditahan karena rebate. **Preview** email-nya.
6. **Approval › Approvals › Approve** rebate: BAAF berubah jadi *Scheduled 4:00 PM*.
7. **FAD › Settlement Run › Approve run**: payment to seller + commission billing tercatat.
8. **VWD › My Tasks › Release vehicle**: penalty ditagih sekaligus.
9. **SMD › SAAF**: Check & print SAAF A231 · EWB → Mark sent to seller → Record signed SAAF (untick satu lot untuk lihat task *seller did not sign*).
10. **Demo events › Next working day**: email terkirim pada 16:00, reminder dan penalty bergerak.
11. **Log Activity**: semua kejadian dengan kolom *Recorded*. Tutup dengan **V1 vs V2** di header.

---

## 6. Pertanyaan yang mungkin muncul dari JBAP

| Pertanyaan | Jawaban singkat |
|---|---|
| Kalau email otomatis salah? | Email tidak langsung keluar: ditahan sampai 16:00, bisa di-Preview dan di-Hold. Isinya bisa diedit seperti V1. |
| Apakah seller harus login ke CDMS? | Tidak. Seller tetap tanda tangan di kertas seperti sekarang; SMD/FAD yang mencatat di CDMS (1-click per dokumen). |
| Kalau seller tidak tanda tangan untuk satu lot di SAAF? | Saat *Record signed SAAF*, lot itu tidak dicentang. Lot masuk SMD › My Tasks dengan tombol **Cancel sale** / **Record approval** (kalau seller setuju belakangan). |
| Kalau kredit bank tidak bisa dicocokkan (nomor akun tidak dikenal, jumlah beda)? | Masuk FAD › My Tasks untuk di-assign manual (1-click), sama seperti assign di Bank Transfer sekarang. |
| Kalau tanggal yang tercatat salah? | Change date dengan alasan, tercatat di Log Activity. |
| Apakah report Access hilang? | Report formal tetap (bagian 3.10). Pipeline menggantikan list harian. |
| Apakah aturan (deadline, penalty, fee) berubah? | Tidak, kecuali usulan pull-out deadline seller DOAS (3.9) yang perlu persetujuan JBAP. |

---

## 7. Belum ada di scratch UI

- Return to Seller dan Security Bond: tetap *as V1*, approval-nya nanti pindah ke Approvals.
- Gabung email per buyer (V1 mengirim satu email per buyer).
- Upload file SAAF bertanda tangan: di demo opsional, di CDMS wajib.
- Layout print (Payment Seller report, billing, transmittal): tetap layout V1.
- Login dan role: demo memakai nama user contoh (smd.user, fad.user, vwd.user, president, fad.manager).
