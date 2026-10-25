import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, RefreshCw, Search } from 'lucide-react';

export default function QrScanner({ onScanSuccess, onSwitchToManual }) {
  const [scannerActive, setScannerActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const isMountedRef = useRef(true);

  // Initialize and discover available video cameras
  useEffect(() => {
    isMountedRef.current = true;
    const scannerElementId = 'reader-viewport';

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMountedRef.current) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if found
          const backCam = devices.find(
            (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMessage('No camera devices detected on this system.');
        }
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        console.warn('Camera access error or permission denied:', err);
        setPermissionDenied(true);
        setErrorMessage(
          'Camera access was denied or is unavailable. Please check your browser permissions or use manual lookup.'
        );
      });

    // Cleanup: ALWAYS stop camera stream when unmounting
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, []);

  // Auto-start scanner when a camera is chosen and no error
  useEffect(() => {
    if (selectedCameraId && !permissionDenied) {
      startScanner(selectedCameraId);
    }
  }, [selectedCameraId]);

  const startScanner = async (cameraId) => {
    try {
      setErrorMessage(null);
      await stopScanner(); // Stop any running instance first

      const html5QrCode = new Html5Qrcode('reader-viewport');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          // Trigger scan callback with the scanned opaque ticket ID
          if (decodedText) {
            onScanSuccess(decodedText.trim());
          }
        },
        (scanError) => {
          // Ignore frequent frame-level parse errors while scanning
        }
      );

      if (isMountedRef.current) {
        setScannerActive(true);
        setPermissionDenied(false);
      }
    } catch (err) {
      console.error('Failed to start scanner:', err);
      if (isMountedRef.current) {
        setScannerActive(false);
        setPermissionDenied(true);
        setErrorMessage(
          'Failed to initialize camera video stream. Permissions might be denied or camera is in use by another app.'
        );
      }
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
    } catch (err) {
      console.warn('Error stopping QR scanner:', err);
    } finally {
      if (isMountedRef.current) {
        setScannerActive(false);
      }
    }
  };

  return (
    <div className="card" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={20} style={{ color: 'var(--accent-primary)' }} />
          Live Camera Scanner
        </h3>

        {cameras.length > 1 && (
          <select
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="form-select"
            style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || `Camera ${c.id.substring(0, 5)}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Camera Viewport Container */}
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: '#030712',
          border: '2px solid rgba(99, 102, 241, 0.3)',
          minHeight: '280px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div id="reader-viewport" style={{ width: '100%', minHeight: '280px' }} />

        {!scannerActive && !errorMessage && (
          <div style={{ position: 'absolute', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <CameraOff size={36} />
            <span style={{ fontSize: '0.875rem' }}>Initializing optical camera...</span>
          </div>
        )}
      </div>

      {/* Permission Denied or Camera Error banner with prominent Manual Lookup fallback */}
      {errorMessage && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontWeight: 600, fontSize: '0.875rem' }}>
            <AlertCircle size={18} />
            <span>Camera Unavailable</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#fecaca', marginTop: '0.25rem' }}>
            {errorMessage}
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            {onSwitchToManual && (
              <button
                onClick={onSwitchToManual}
                className="btn btn-sm btn-primary"
                style={{ flex: 1 }}
              >
                <Search size={14} />
                Switch to Manual Lookup
              </button>
            )}
            <button
              onClick={() => selectedCameraId && startScanner(selectedCameraId)}
              className="btn btn-sm btn-secondary"
            >
              <RefreshCw size={14} />
              Retry Camera
            </button>
          </div>
        </div>
      )}

      {/* Instructions & Manual Fallback Button */}
      <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Position the attendee’s digital QR ticket within the camera viewfinder. The ticket ID will be validated automatically.
        </p>
        {onSwitchToManual && (
          <button
            onClick={onSwitchToManual}
            className="btn btn-outline btn-sm"
            style={{ alignSelf: 'center' }}
          >
            <Search size={14} />
            Having trouble? Use Manual Lookup
          </button>
        )}
      </div>
    </div>
  );
}
