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
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          aspectRatio: 1.0
        }
      )

      html5QrcodeScanner.current.render(
        (decodedText) => {
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
        html5QrcodeScanner.current.clear()
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
          <h3 className="text-lg font-semibold">QR Code Scanner</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scanner Area */}
      <div id="qr-reader" ref={scannerRef} className="rounded-lg overflow-hidden"></div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-400 mb-1">Scanner Instructions</p>
            <ul className="space-y-1 text-gray-300">
              <li>• Position the QR code within the scanner frame</li>
              <li>• Ensure good lighting and steady camera</li>
              <li>• The scanner will automatically detect valid codes</li>
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
