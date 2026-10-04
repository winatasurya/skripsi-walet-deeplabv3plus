import os
import cv2
import numpy as np
from PIL import Image
import io
import base64

# Kelas segmentasi: 0 = Background, 1 = Sarang Bersih, 2 = Kotoran

class BirdNestSegmenter:
    def __init__(self, model_path=None):
        self.model_path = model_path or os.path.join("models", "best", "deeplabv3plus_walet_light.keras")
        self.model = None
        self.has_real_model = False
        self.rembg_session = None
        self._load_model()
        
    def _load_model(self):
        import time
        start_load = time.time()
        self.model_load_time_ms = 0
        
        try:
            import tensorflow as tf
            import keras_cv
            from rembg import new_session
            
            start_load = time.time()
            
            # Sesi rembg model u2netp (ringan & cepat)
            self.rembg_session = new_session("u2netp")
            
            if os.path.exists(self.model_path):
                if self.model_path.endswith('.keras'):
                    try:
                        self.model = tf.keras.models.load_model(self.model_path)
                    except Exception as e:
                        print(f"Gagal memuat .keras: {e}, mencoba arsitektur manual...")
                        backbone = keras_cv.models.ResNet50V2Backbone.from_preset(
                            preset="resnet50_v2_imagenet",
                            input_shape=(256, 256, 3),
                            load_weights=False
                        )
                        self.model = keras_cv.models.segmentation.DeepLabV3Plus(
                            num_classes=3,
                            backbone=backbone,
                        )
                        self.model.load_weights(self.model_path)
                else:
                    backbone = keras_cv.models.ResNet50V2Backbone.from_preset(
                        preset="resnet50_v2_imagenet",
                        input_shape=(256, 256, 3),
                        load_weights=False
                    )
                    self.model = keras_cv.models.segmentation.DeepLabV3Plus(
                        num_classes=3,
                        backbone=backbone,
                    )
                    self.model.load_weights(self.model_path)
                    
                self.has_real_model = True
                print(f"Model loaded: {self.model_path}")
                
                # Kompilasi tf.function untuk performa inferensi
                self.fast_predict = tf.function(self.model)
                
                end_load = time.time()
                self.model_load_time_ms = round((end_load - start_load) * 1000)
                print(f"Load time: {self.model_load_time_ms / 1000:.2f}s")
                
                # Warmup agar inferensi pertama tidak lambat
                print("Warming up model...")
                import numpy as np
                from rembg import remove
                
                start_warmup = time.time()
                dummy_tensor = tf.zeros((1, 256, 256, 3), dtype=tf.float32)
                _ = self.fast_predict(dummy_tensor, training=False)
                dummy_bgr = np.zeros((256, 256, 3), dtype=np.uint8)
                _ = remove(dummy_bgr, session=self.rembg_session)
                
                print(f"Warmup done in {(time.time() - start_warmup):.2f}s")
                
            else:
                end_load = time.time()
                self.model_load_time_ms = round((end_load - start_load) * 1000)
                print(f"Model tidak ditemukan: {self.model_path}. Mock mode aktif.")
        except Exception as e:
            end_load = time.time()
            self.model_load_time_ms = round((end_load - start_load) * 1000)
            print(f"Tidak dapat memuat model: {str(e)}. Mock mode aktif.")
            
    def run_inference(self, image_bytes: bytes, target_size=(512, 512)):
        """Jalankan segmentasi. Pakai model riil jika tersedia, fallback ke mock OpenCV."""
        import time
        start_time = time.time()
        
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("Citra tidak valid atau tidak dapat didecode.")
            
        h_orig, w_orig = img_bgr.shape[:2]
        
        # Batasi resolusi maks 800px untuk kecepatan encoding base64
        max_dim = 800
        if max(h_orig, w_orig) > max_dim:
            scale = max_dim / max(h_orig, w_orig)
            new_w, new_h = int(w_orig * scale), int(h_orig * scale)
            img_bgr = cv2.resize(img_bgr, (new_w, new_h))
            h_orig, w_orig = new_h, new_w
        
        if self.has_real_model:
            try:
                import tensorflow as tf
                from rembg import remove
                
                img_resized_bgr = cv2.resize(img_bgr, (256, 256))
                
                # Hapus background lalu ganti dengan hitam
                img_nobg_rgba = remove(img_resized_bgr, session=self.rembg_session)
                img_nobg_rgb = cv2.cvtColor(img_nobg_rgba, cv2.COLOR_BGRA2BGR)
                img_rgb_input = cv2.cvtColor(img_nobg_rgb, cv2.COLOR_BGR2RGB)
                
                # Normalisasi [0, 1] dan prediksi
                img_tensor = tf.convert_to_tensor(img_rgb_input, dtype=tf.float32) / 255.0
                img_tensor = tf.expand_dims(img_tensor, axis=0)
                
                pred = self.fast_predict(img_tensor, training=False)
                pred_mask = tf.argmax(pred[0], axis=-1).numpy()
                
                # Resize mask ke ukuran asli (nearest-neighbor untuk preserve class index)
                raw_mask = cv2.resize(pred_mask.astype(np.uint8), (w_orig, h_orig), interpolation=cv2.INTER_NEAREST)
                
                # Remap label: model melatih 1=Kotoran 2=Sarang, sistem pakai 1=Sarang 2=Kotoran
                mask = np.zeros_like(raw_mask)
                mask[raw_mask == 0] = 0
                mask[raw_mask == 1] = 2
                mask[raw_mask == 2] = 1
                
                method = "DeepLabV3+"
            except Exception as e:
                print(f"Error inferensi: {e}. Fallback ke mock.")
                mask = self._generate_adaptive_mock_mask(img_bgr)
                method = "Adaptive CV (Mock)"
        else:
            mask = self._generate_adaptive_mock_mask(img_bgr)
            method = "Adaptive CV (Mock)"
            
        # Hitung statistik
        sarang_pixels = np.sum(mask == 1)
        kotoran_pixels = np.sum(mask == 2)
        total_nest_pixels = sarang_pixels + kotoran_pixels
        
        if total_nest_pixels > 0:
            kotoran_percentage = (kotoran_pixels / total_nest_pixels) * 100
            sarang_percentage = (sarang_pixels / total_nest_pixels) * 100
        else:
            kotoran_percentage = 0.0
            sarang_percentage = 0.0
            
        kebersihan_percentage = 100.0 - kotoran_percentage
        
        # Buat overlay: arsiran merah di area kotoran
        overlay = img_bgr.copy()
        overlay[mask == 2] = [0, 0, 255]
        img_overlayed = cv2.addWeighted(img_bgr, 0.6, overlay, 0.45, 0)
        
        # Masker visual: hitam=BG, teal=sarang, merah=kotoran
        visual_mask = np.zeros((h_orig, w_orig, 3), dtype=np.uint8)
        visual_mask[mask == 0] = [15, 17, 23]
        visual_mask[mask == 1] = [180, 150, 49]
        visual_mask[mask == 2] = [0, 0, 255]
        
        # Encode ke base64
        _, buffer_orig = cv2.imencode('.jpg', img_bgr)
        base64_orig = base64.b64encode(buffer_orig).decode('utf-8')
        
        _, buffer_overlay = cv2.imencode('.jpg', img_overlayed)
        base64_overlay = base64.b64encode(buffer_overlay).decode('utf-8')
        
        _, buffer_mask = cv2.imencode('.png', visual_mask)
        base64_mask = base64.b64encode(buffer_mask).decode('utf-8')
        
        inference_time_ms = (time.time() - start_time) * 1000
            
        return {
            "success": True,
            "method": method,
            "metrics": {
                "kebersihan_percentage": round(kebersihan_percentage, 2),
                "kotoran_percentage": round(kotoran_percentage, 2),
                "sarang_percentage": round(sarang_percentage, 2),
                "sarang_pixels": int(sarang_pixels),
                "kotoran_pixels": int(kotoran_pixels),
                "total_nest_pixels": int(total_nest_pixels),
                "inference_time_ms": round(inference_time_ms)
            },
            "images": {
                "original": f"data:image/jpeg;base64,{base64_orig}",
                "overlay": f"data:image/jpeg;base64,{base64_overlay}",
                "mask": f"data:image/png;base64,{base64_mask}"
            }
        }
        
    def _generate_adaptive_mock_mask(self, img_bgr):
        """
        Segmentasi adaptif berbasis OpenCV.
        Pisahkan sarang (area terang) dari background menggunakan Otsu thresholding,
        lalu deteksi kotoran (area gelap lokal) menggunakan perbandingan kontras gradien.
        """
        h, w = img_bgr.shape[:2]
        
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Deteksi area sarang: Otsu + brightness threshold
        _, otsu_thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        bright_mask = cv2.inRange(blur, 85, 255)
        nest_mask = cv2.bitwise_and(otsu_thresh, bright_mask)
        
        # Morfologi: tutup celah serat, buang noise
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        nest_mask = cv2.morphologyEx(nest_mask, cv2.MORPH_CLOSE, kernel_close)
        nest_mask = cv2.morphologyEx(nest_mask, cv2.MORPH_OPEN, kernel_open)
        
        # Deteksi kotoran: pixel yang <= 72% dari rata-rata kecerahan lokal
        local_mean = cv2.boxFilter(gray, -1, (25, 25))
        dark_mask = np.zeros((h, w), dtype=np.uint8)
        dark_mask[gray <= (local_mean * 0.72)] = 255
        
        # Filter: hanya di dalam area sarang dan kecerahan < 165
        kotoran_mask = cv2.bitwise_and(dark_mask, nest_mask)
        kotoran_mask[gray > 165] = 0
        kotoran_mask = cv2.morphologyEx(kotoran_mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2)))
        
        # Bangun mask akhir
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[nest_mask > 0] = 1
        mask[kotoran_mask > 0] = 2
        mask[nest_mask == 0] = 0
        
        return mask
