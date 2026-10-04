# Deteksi Kontaminasi Kotoran Sarang Burung Walet

Semantic Segmentation dengan DeepLabV3+ (Backbone: ResNet-50V2)

**Nama:** Made Surya Winata
**NIM:** 2215354088
**Topik:** Aplikasi Deteksi Kontaminasi Kotoran pada Sarang Burung Walet di Wilayah Lombok Barat

---

## Deskripsi

Proyek skripsi ini membangun model semantic segmentation berbasis DeepLabV3+ untuk mendeteksi kontaminasi kotoran (bulu halus, bulu kasar, noda organik) pada citra sarang burung walet secara otomatis pada tingkat piksel.

Output yang dihasilkan:
- **Masking image (Overlay)** — Visualisasi area kotoran pada gambar asli
- **Persentase Kebersihan** — Luas area kotoran vs total area sarang
- **Grade Kualitas** — Klasifikasi otomatis (Grade A / B / C)

---

## Teknologi

| Komponen | Detail |
|----------|--------|
| Model AI | DeepLabV3+ |
| Backbone | ResNet-50V2 |
| Framework Training | TensorFlow / Keras (Google Colab GPU) |
| Backend API | FastAPI (Python) |
| Frontend Web | React.js + Vite |
| Dataset | Roboflow (citra sarang burung walet dari Lombok Barat) |
| Evaluasi Metrik | IoU, Pixel Accuracy, Precision, Recall, F1-Score |

---

## Struktur Folder

```
skripsi-walet-deeplabv3plus/
├── app/                       # Backend API (FastAPI)
│   ├── main.py                # Entry point API server
│   ├── inference.py           # Logika pemuatan model & segmentasi
│   ├── uploads/               # Penyimpanan gambar yang diunggah
│   └── results/               # Penyimpanan hasil segmentasi
├── frontend/                  # Frontend Web (React + Vite)
│   ├── src/
│   ├── dist/                  # Hasil build production
│   └── package.json
├── models/
│   └── best/
│       └── deeplabv3plus_walet_light.keras
├── notebooks/
│   └── DeepLabV3Plus_Walet_v3.ipynb
├── configs/
│   └── config.yaml
├── Dockerfile
├── jalankan_aplikasi.bat      # Launcher 1-klik (Windows)
├── requirements.txt
└── README.md
```

---

## Cara Menjalankan

### Opsi 1: Windows (Tercepat)

Klik dua kali `jalankan_aplikasi.bat`, browser akan otomatis terbuka di `http://127.0.0.1:8000`.

### Opsi 2: Manual

```bash
# Pastikan Git LFS aktif agar file model .keras terunduh utuh
git lfs install
git clone https://github.com/winatasurya/skripsi-walet-deeplabv3plus.git
cd skripsi-walet-deeplabv3plus

# Install dependensi (disarankan Python 3.10 atau 3.11)
pip install -r requirements.txt

# Jalankan server
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Buka browser di http://localhost:8000
```

### Opsi 3: Docker

```bash
docker build -t nest-sense .
docker run -p 8000:8000 nest-sense
```

---

## Training Ulang Model

Training dilakukan di Google Colab (membutuhkan GPU):

1. Buka `notebooks/DeepLabV3Plus_Walet_v3.ipynb` di Google Colab
2. Jalankan seluruh cell dari atas ke bawah
3. Download file `.keras` yang dihasilkan
4. Letakkan di `models/best/`

---

## Hasil Evaluasi

| Metrik | Skor |
|--------|------|
| Pixel Accuracy | 98.44% |
| Mean IoU | 85.01% |
| Mean Precision | 90.78% |
| Mean Recall | 91.48% |

---

## Lisensi

Proyek ini dibuat untuk keperluan akademis (Skripsi) di Program Studi Sarjana Terapan Teknologi Rekayasa Perangkat Lunak, Jurusan Teknologi Informasi, Politeknik Negeri Bali.
