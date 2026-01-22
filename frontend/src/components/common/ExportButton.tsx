import { useState } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'

interface ExportButtonProps {
  data: any[]
  filename: string
  className?: string
}

export const ExportButton = ({ data, filename, className = '' }: ExportButtonProps) => {
  const [showMenu, setShowMenu] = useState(false)

  const exportToCSV = () => {
    if (data.length === 0) {
      alert('No data to export')
      return
    }

    // Get all unique keys from the data
    const keys = Array.from(
      new Set(data.flatMap(item => Object.keys(item)))
    )

    // Create CSV header
    const csvHeader = keys.join(',')

    // Create CSV rows
    const csvRows = data.map(item =>
      keys.map(key => {
        const value = item[key]
        // Handle values that contain commas, quotes, or newlines
        if (value === null || value === undefined) {
          return ''
        }
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )

    // Combine header and rows
    const csv = [csvHeader, ...csvRows].join('\n')

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setShowMenu(false)
  }

  const exportToJSON = () => {
    if (data.length === 0) {
      alert('No data to export')
      return
    }

    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setShowMenu(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors ${className}`}
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1" role="menu">
              <button
                onClick={exportToCSV}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
              >
                <FileText className="w-4 h-4" />
                <span>Export as CSV</span>
              </button>
              <button
                onClick={exportToJSON}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
              >
                <FileJson className="w-4 h-4" />
                <span>Export as JSON</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
