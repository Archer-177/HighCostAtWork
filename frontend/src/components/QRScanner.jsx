import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Camera, AlertCircle } from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'

export default function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const html5QrcodeScanner = useRef(null)

  useEffect(() => {
    if (!html5QrcodeScanner.current) {
      html5QrcodeScanner.current = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 20,
          // qrbox: { width: 250, height: 250 }, // Removed to allow full-frame scanning
          rememberLastUsedCamera: true,
          verbose: true
        }
      )

      html5QrcodeScanner.current.render(
        (decodedText) => {
          console.log("QR Code Scanned:", decodedText)
          onScan(decodedText)
          html5QrcodeScanner.current.clear()
        },
        (error) => {
          // Silently handle scan errors
        }
      )
    }

    return () => {
      if (html5QrcodeScanner.current) {
        try {
          // Attempt to clear, but don't block unmounting
          html5QrcodeScanner.current.clear().catch(err => {
            console.warn("Failed to clear scanner", err)
          })
        } catch (e) {
          console.warn("Error during scanner cleanup", e)
        }
        html5QrcodeScanner.current = null
      }
    }
  }, [onScan])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative bg-gray-900 rounded-xl p-6 text-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6 text-maroon-400" />
          <h3 className="text-lg font-semibold">Scan QR Code</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scanner Area */}
      <div id="qr-reader" ref={scannerRef} className="rounded-lg overflow-hidden" style={{ maxWidth: '500px', margin: '0 auto' }}></div>
      <style>{`
        #qr-reader video {
          object-fit: cover;
          border-radius: 0.5rem;
        }
      `}</style>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-400 mb-1">Scanner Instructions</p>
            <ul className="space-y-1 text-gray-300">
              <li>• Position the QR code within the scanner frame</li>
              <li>• Ensure good lighting and steady camera</li>
              <li className="text-white font-bold pt-2 border-t border-gray-700 mt-2">
                • OR simply use your handheld scanner now
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Scanner Animation Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative w-64 h-64">
          <div className="scanner-line"></div>
        </div>
      </div>
    </motion.div>
  )
}
