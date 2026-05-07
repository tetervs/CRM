import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'

export function PageWrapper({ children }) {
  return (
    <div className="flex h-screen bg-surface-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
