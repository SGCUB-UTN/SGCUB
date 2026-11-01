import { Outlet } from 'react-router-dom'
import '../App.css'

export default function AdminLayout() {
  return (
    <div className="admin-container">
      {/*<AdminSidebar />*/}
      <div className="admin-content">
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
