import Footer from "../common/Footer.jsx";
import Header from "../common/Header.jsx";
import MobileActionBar from "../common/MobileActionBar.jsx";
import TopButton from "../common/TopButton.jsx";

export default function MainLayout({ children, currentPage, onNavigate }) {
  const isAdminPage = currentPage === "admin";

  return (
    <div className={`site-shell ${isAdminPage ? "site-shell-admin" : ""}`}>
      <Header currentPage={currentPage} onNavigate={onNavigate} />
      <main className={isAdminPage ? "admin-main" : undefined}>{children}</main>
      <Footer />
      {!isAdminPage ? <MobileActionBar /> : null}
      {!isAdminPage ? <TopButton /> : null}
    </div>
  );
}
