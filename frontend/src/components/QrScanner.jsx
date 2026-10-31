import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, RefreshCw, Search } from 'lucide-react';

export default function QrScanner({ onScanSuccess, onSwitchToManual }) {
  const [scannerActive, setScannerActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const html5QrCodeRef = useRef(null);
  const isMountedRef = useRef(true);

  // Initialize and discover available video cameras
  useEffect(() => {
    isMountedRef.current = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMountedRef.current) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if found for mobile venue scanning
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
          'Camera access was denied or is unavailable. Please verify browser permissions or switch to manual lookup.'
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
      await stopScanner(); // Stop running instance before re-initializing

      const html5QrCode = new Html5Qrcode('reader-viewport');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          if (decodedText) {
            onScanSuccess(decodedText.trim());
          }
        },
        () => {
          // Ignore transient per-frame decode misses
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
          'Failed to initialize camera video stream. Permissions might be denied or the camera is occupied by another application.'
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
      console.warn('Notice stopping QR scanner:', err);
    } finally {
      if (isMountedRef.current) {
        setScannerActive(false);
      }
    }
  };

  return (
    <div className="card" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Camera size={18} style={{ color: 'var(--accent-pink)' }} />
          Live Camera Viewfinder
        </h3>

        {cameras.length > 1 && (
          <select
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="form-select"
            style={{ width: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
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
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: '#0D0E12',
          border: '1px solid var(--border-default)',
          minHeight: '270px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div id="reader-viewport" style={{ width: '100%', minHeight: '270px' }} />

        {!scannerActive && !errorMessage && (
          <div style={{ position: 'absolute', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <CameraOff size={32} />
            <span style={{ fontSize: '0.8125rem' }}>Initializing optical camera stream...</span>
          </div>
        )}
      </div>

      {/* Error banner with fallback to Manual Lookup */}
      {errorMessage && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--status-error-bg)',
            border: '1px solid var(--status-error-border)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-error)', fontWeight: 600, fontSize: '0.8125rem' }}>
            <AlertCircle size={16} />
            <span>Camera Access Notice</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#FCA5A5', marginTop: '0.25rem' }}>
            {errorMessage}
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            {onSwitchToManual && (
              <button
                onClick={onSwitchToManual}
                className="btn btn-sm btn-primary"
                style={{ flex: 1 }}
              >
                <Search size={13} />
                <span>Switch to Manual Lookup</span>
              </button>
            )}
            <button
              onClick={() => selectedCameraId && startScanner(selectedCameraId)}
              className="btn btn-sm btn-secondary"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual lookup prompt */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Position attendee QR pass in front of lens. Scans are submitted and validated automatically.
        </p>
        {onSwitchToManual && (
          <button
            onClick={onSwitchToManual}
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'center' }}
          >
            <Search size={13} />
            <span>Camera unavailable? Use Manual Attendee Lookup</span>
          </button>
        )}
      </div>
    </div>
  );
}
