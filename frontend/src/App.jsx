import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('deteksi');
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [resultTab, setResultTab] = useState('overlay');
  const [backendStatus, setBackendStatus] = useState({ online: false, has_real_model: false });

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        setBackendStatus({ online: true, has_real_model: data.has_real_model, model_load_time_ms: data.model_load_time_ms });
      })
      .catch(() => {
        setBackendStatus({ online: false, has_real_model: false });
      });
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert("Format file ditolak! Sistem hanya menerima file gambar dengan format JPG, JPEG, atau PNG.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setDetectionResult(null);
    };
    reader.readAsDataURL(file);
  };

  const [dragActive, setDragActive] = useState(false);
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setSelectedImage(null);
    setSelectedFile(null);
    setDetectionResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Gagal membuka kamera:", err);
      alert("Tidak dapat mengakses kamera. Silakan unggah gambar dari galeri Anda.");
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      setSelectedImage(dataUrl);
      
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "kamera_capture.jpg", { type: "image/jpeg" });
          setSelectedFile(file);
        });
        
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const handleReset = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setDetectionResult(null);
    stopCamera();
  };

  const handleDetect = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    setDetectionResult(null);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const response = await fetch('/api/detect', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Gagal melakukan pemrosesan di server.");
      }
      
      const data = await response.json();
      setDetectionResult(data);
    } catch (err) {
      console.error("Error deteksi:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCircularGauge = (percentage) => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const isClean = percentage >= 96.0;

    return (
      <div className="gauge-wrapper">
        <svg className="gauge-svg" viewBox="0 0 160 160">
          <circle className="gauge-bg" cx="80" cy="80" r={radius} />
          <circle 
            className={`gauge-fill ${isClean ? '' : 'dirty'}`} 
            cx="80" 
            cy="80" 
            r={radius} 
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="gauge-text">
          <span className="gauge-number">{percentage}%</span>
          <span className="gauge-percent">BERSIH</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="app-header">
        <div className="header-container">
          <div className="header-title-section">
            <div className="header-logo">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8c0 0 2 6 9 6s9-6 9-6" />
                <path d="M6 11c0 0 1.5 4 6 4s6-4 6-4" />
                <path d="M9 14c0 0 1 2 3 2s3-2 3-2" />
                <path d="M12 2a15 15 0 0 0-9 6M12 2a15 15 0 0 1 9 6" />
              </svg>
            </div>
            <div className="header-meta">
              <h1>NEST SENSE</h1>
              <p>Sistem Analisis Kebersihan Sarang Walet</p>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        
        <div className="page-container detection-grid">
            
            {/* Panel Input */}
            <div className="card">
              <h2 className="card-title">
                {isCameraActive ? 'Kamera Aktif' : selectedImage ? 'Citra Terpilih' : 'Input Gambar Sarang Walet'}
              </h2>

              {isCameraActive && (
                <div className="preview-container">
                  <div className="camera-wrapper">
                    <video ref={videoRef} autoPlay playsInline className="camera-video" />
                    <div className="camera-viewfinder-corner top-left" />
                    <div className="camera-viewfinder-corner top-right" />
                    <div className="camera-viewfinder-corner bottom-left" />
                    <div className="camera-viewfinder-corner bottom-right" />
                    <div className="camera-scan-overlay" />
                  </div>
                  <div className="camera-controls">
                    <button className="btn-capture" onClick={capturePhoto} title="Ambil Foto">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button className="btn-cancel" onClick={stopCamera} title="Batalkan">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <p className="camera-hint">
                    Posisikan sarang burung walet tepat di tengah frame kamera.
                  </p>
                </div>
              )}

              {!isCameraActive && selectedImage && (
                <div className="preview-container">
                  <img src={selectedImage} alt="Preview" className="img-preview" />
                  
                  {!loading && !detectionResult && (
                    <button className="btn-primary" onClick={handleDetect}>
                      Jalankan Analisis
                    </button>
                  )}

                  {!loading && (
                    <button className="btn-choice btn-full-width" onClick={handleReset}>
                      Unggah Ulang / Ambil Foto Baru
                    </button>
                  )}
                </div>
              )}

              {!isCameraActive && !selectedImage && (
                <div 
                  className={`upload-container ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('walet-file-input').click()}
                >
                  <svg className="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                  </svg>
                  <div className="upload-text">
                    <h3>Unggah Foto Sarang Walet</h3>
                    <p>Tarik dan lepas file gambar di sini, atau cari berkas dari perangkat Anda</p>
                    <p className="upload-format-hint">
                      Mendukung format JPEG, JPG, atau PNG
                    </p>
                  </div>
                  <input 
                    type="file" 
                    id="walet-file-input" 
                    className="file-input" 
                    accept="image/*"
                    onChange={handleFileChange} 
                  />
                </div>
              )}

              {!isCameraActive && !selectedImage && (
                <div className="input-choice">
                  <button className="btn-choice" onClick={startCamera}>
                    Ambil Citra Lewat Kamera
                  </button>
                </div>
              )}

              {loading && (
                <div className="loading-box">
                  <div className="spinner" />
                  <div className="loading-text">
                    <h3>Menganalisis Kualitas...</h3>
                    <p>Sedang memproses citra dan memetakan kontaminasi kotoran secara presisi</p>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Hasil */}
            <div className="card card-results">
              <h2 className="card-title">Hasil Analisis & Visualisasi</h2>

              {detectionResult ? (
                <div className="results-container">
                  
                  <div className="result-tabs-nav">
                    <button 
                      className={`result-tab-btn ${resultTab === 'overlay' ? 'active' : ''}`}
                      onClick={() => setResultTab('overlay')}
                    >
                      Gambar Arsiran (Overlay)
                    </button>
                    <button 
                      className={`result-tab-btn ${resultTab === 'original' ? 'active' : ''}`}
                      onClick={() => setResultTab('original')}
                    >
                      Citra Asli
                    </button>
                    <button 
                      className={`result-tab-btn ${resultTab === 'mask' ? 'active' : ''}`}
                      onClick={() => setResultTab('mask')}
                    >
                      Masker Deteksi
                    </button>
                  </div>

                  <div className="result-image-display">
                    {resultTab === 'overlay' && (
                      <>
                        <img src={detectionResult.images.overlay} alt="Overlay" className="result-img" />
                        <span className="result-image-label label-dirty">
                          Arsiran Merah: Area Kotoran
                        </span>
                      </>
                    )}
                    {resultTab === 'original' && (
                      <>
                        <img src={detectionResult.images.original} alt="Original" className="result-img" />
                        <span className="result-image-label label-brand">
                          Citra Asli
                        </span>
                      </>
                    )}
                    {resultTab === 'mask' && (
                      <>
                        <img src={detectionResult.images.mask} alt="Mask" className="result-img" />
                        <span className="result-image-label label-dark">
                          Peta Segmentasi Piksel
                        </span>
                      </>
                    )}
                  </div>

                  <div className="metrics-section">
                    {renderCircularGauge(detectionResult.metrics.kebersihan_percentage)}
                    
                    <h3 className="metrics-title">Tingkat Kebersihan Sarang</h3>
                    <p className="metrics-subtitle">
                      Persentase kebersihan berdasarkan ekstraksi kotoran fisik
                    </p>
                  </div>

                  <div className="stats-list">
                    <div className="stat-item">
                      <span className="stat-label">
                        <span className="stat-dot clean" /> Area Sarang Bersih
                      </span>
                      <span className="stat-value">{detectionResult.metrics.sarang_percentage}%</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">
                        <span className="stat-dot dirty" /> Persentase Kotoran (Impurities)
                      </span>
                      <span className="stat-value stat-value-dirty">
                        {detectionResult.metrics.kotoran_percentage}%
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">
                        <span className="stat-dot total" /> Total Area Teranalisis
                      </span>
                      <span className="stat-value">{detectionResult.metrics.total_nest_pixels.toLocaleString()} piksel</span>
                    </div>
                    {detectionResult.metrics.inference_time_ms && (
                      <div className="stat-item">
                        <span className="stat-label">
                          <span className="stat-dot stat-dot-neutral" /> Waktu Pemrosesan (Inferensi)
                        </span>
                        <span className="stat-value">
                          {(detectionResult.metrics.inference_time_ms / 1000).toFixed(2)} detik
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="method-label">
                    Metode Pemrosesan: {detectionResult.method}
                  </p>

                </div>
              ) : (
                <div className="empty-state">
                  <p className="empty-state-title">Belum Ada Analisis</p>
                  <p className="empty-state-desc">
                    Silakan unggah gambar sarang walet atau ambil foto lewat kamera di sisi kiri, kemudian jalankan analisis untuk memetakan kontaminasi kotoran.
                  </p>
                </div>
              )}
            </div>

        </div>
        
        <div className="section-divider"></div>

        {/* Bagian Evaluasi Model */}
        <div className="page-container card">
            <h2 className="section-title">Akurasi & Evaluasi Pengujian</h2>
            <p className="section-subtitle">
              Ringkasan metrik kinerja model Deep Learning dengan arsitektur DeepLabV3+ pada pengujian segmentasi kotoran fisik tingkat piksel.
            </p>

            <div className="grid-two-cols">
              <div>
                <h3 className="eval-heading">
                  Target Metrik & Kriteria Uji Mutu
                </h3>
                
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-val">98.44%</div>
                    <div className="metric-name">Pixel Accuracy</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-val">85.01%</div>
                    <div className="metric-name">Mean IoU (mIoU)</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-val">90.78%</div>
                    <div className="metric-name">Mean Precision</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-val">91.48%</div>
                    <div className="metric-name">Mean Recall</div>
                  </div>
                </div>

                <div className="stats-list eval-stats">
                  <div className="stat-item stat-item-info">
                    <span className="stat-item-heading">Metode Evaluasi Piksel</span>
                    <p className="stat-item-desc">
                      Model dievaluasi menggunakan ribuan anotasi tingkat piksel. Penilaian performa dihitung berdasarkan perbandingan irisan (intersection over union) antara hasil prediksi sistem dan ground truth manual untuk menjamin keandalan pengujian.
                    </p>
                  </div>
                  <div className="stat-item stat-item-info">
                    <span className="stat-item-heading">Pengujian Fungsionalitas</span>
                    <p className="stat-item-desc">
                      Pengujian keandalan aplikasi web ini menerapkan metode Black Box Testing untuk memvalidasi alur masukan citra, validasi berkas, jepretan kamera, waktu respon inferensi, dan visualisasi luaran secara presisi.
                    </p>
                  </div>
                  <div className="stat-item stat-item-success">
                    <span className="stat-item-heading stat-item-heading-success">Waktu Pemuatan Model (Startup)</span>
                    <p className="stat-item-desc">
                      Waktu riil yang dibutuhkan server untuk menyiapkan beban komputasi AI awal: <strong>{backendStatus.model_load_time_ms ? (backendStatus.model_load_time_ms / 1000).toFixed(2) + ' detik' : 'Menghitung...'}</strong>. (Memenuhi target spesifikasi kinerja ≤ 10 detik).
                    </p>
                  </div>
                </div>
              </div>

              <div className="class-metrics-box">
                <h3 className="eval-heading eval-heading-start">
                  Evaluasi Metrik Per-Kelas (Validation Set)
                </h3>
                
                <div className="class-metrics-table">
                  {/* Header */}
                  <div className="cmt-header">Kelas</div>
                  <div className="cmt-header cmt-center">IoU</div>
                  <div className="cmt-header cmt-center">Precision</div>
                  <div className="cmt-header cmt-center">Recall</div>
                  <div className="cmt-header cmt-center">F1-Score</div>
                  
                  {/* Background */}
                  <div className="cmt-label">Background</div>
                  <div className="cmt-cell">0.9917</div>
                  <div className="cmt-cell">0.9989</div>
                  <div className="cmt-cell">0.9928</div>
                  <div className="cmt-cell">0.9958</div>
                  
                  {/* Sarang Bersih */}
                  <div className="cmt-label cmt-label-clean">Sarang Bersih</div>
                  <div className="cmt-cell cmt-cell-clean">0.9193</div>
                  <div className="cmt-cell cmt-cell-clean">0.9451</div>
                  <div className="cmt-cell cmt-cell-clean">0.9711</div>
                  <div className="cmt-cell cmt-cell-clean">0.9579</div>
                  
                  {/* Kotoran */}
                  <div className="cmt-label cmt-label-dirty">Kotoran</div>
                  <div className="cmt-cell cmt-cell-dirty">0.6394</div>
                  <div className="cmt-cell cmt-cell-dirty">0.7796</div>
                  <div className="cmt-cell cmt-cell-dirty">0.7806</div>
                  <div className="cmt-cell cmt-cell-dirty">0.7801</div>
                </div>

                <p className="class-metrics-note">
                  Tabel di atas mengukur performa prediksi AI secara spesifik untuk masing-masing kelas. Semakin mendekati angka 1.0, semakin sempurna deteksi sistem.
                </p>
              </div>
            </div>
          </div>
      </main>

      <footer className="app-footer">
        <div className="footer-container">
          <p>&copy; 2026 NEST SENSE. Hak Cipta Dilindungi.</p>
          <div className="footer-status-pills">
            <span className="status-pill">Status: {backendStatus.online ? 'Aktif' : 'Simulasi'}</span>
            <span className="status-pill">Sistem: {backendStatus.has_real_model ? 'Model Utama' : 'Metode Analisis'}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
