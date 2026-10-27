import GallerySection from "../components/sections/GallerySection.jsx";
import HeroSection from "../components/sections/HeroSection.jsx";
import LocalInfoSection from "../components/sections/LocalInfoSection.jsx";
import MapSection from "../components/sections/MapSection.jsx";
import MenuSection from "../components/sections/MenuSection.jsx";
import NoticeSection from "../components/sections/NoticeSection.jsx";
import ReservationSection from "../components/sections/ReservationSection.jsx";
import ReviewGuideSection from "../components/sections/ReviewGuideSection.jsx";
import ReviewSection from "../components/sections/ReviewSection.jsx";
import StoreInfoSection from "../components/sections/StoreInfoSection.jsx";
import { menuGalleryItems } from "../data/siteData.js";

const pageCopy = {
  menu: {
    eyebrow: "Menu",
    title: "동해회조개구이 메뉴",
    description: "대표 세트, 조개구이, 해산물 식사 메뉴를 사진과 함께 확인할 수 있게 구성했습니다.",
  },
  store: {
    eyebrow: "Store",
    title: "매장소개",
    description: "주소, 전화번호, 영업시간, 매장 분위기와 방문 전 확인할 정보를 한 화면에 정리했습니다.",
  },
  reviews: {
    eyebrow: "Reviews",
    title: "방문자 리뷰",
    description: "네이버 플레이스 기준 리뷰 수와 최신 리뷰 확인 경로를 한 화면에서 확인할 수 있습니다.",
  },
  location: {
    eyebrow: "Location",
    title: "찾아오시는길",
    description: "을왕리해수욕장 인근 위치, 길찾기, 전화, 주소 복사를 빠르게 사용할 수 있습니다.",
  },
  reservation: {
    eyebrow: "Guide",
    title: "이용안내",
    description: "예약, 영업 상태, 메뉴 가격, 방문 전 확인 사항을 한 화면에 정리했습니다.",
  },
};

function PageView({ page, children }) {
  const copy = pageCopy[page];

  return (
    <section className={`subpage-view subpage-${page}`} aria-labelledby="subpage-title">
      <div className="container subpage-heading">
        <p className="section-eyebrow">{copy.eyebrow}</p>
        <h1 id="subpage-title">{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      <div className="subpage-content">{children}</div>
    </section>
  );
}

function HomeView() {
  return (
    <>
      <HeroSection />
      <ReviewSection />
      <div className="container dashboard-grid home-dashboard-grid">
        <MenuSection />
        <StoreInfoSection variant="summary" />
        <MapSection variant="summary" />
      </div>
    </>
  );
}

export default function Home({ currentPage = "home" }) {
  if (currentPage === "menu") {
    return (
      <PageView page="menu">
        <div className="container subpage-card-grid">
          <MenuSection variant="full" />
        </div>
        <GallerySection items={menuGalleryItems} title="메뉴 사진 갤러리" />
      </PageView>
    );
  }

  if (currentPage === "store") {
    return (
      <PageView page="store">
        <div className="container subpage-card-grid">
          <StoreInfoSection />
        </div>
      </PageView>
    );
  }

  if (currentPage === "reviews") {
    return (
      <PageView page="reviews">
        <ReviewGuideSection />
        <LocalInfoSection />
      </PageView>
    );
  }

  if (currentPage === "location") {
    return (
      <PageView page="location">
        <div className="container subpage-card-grid">
          <MapSection />
        </div>
      </PageView>
    );
  }

  if (currentPage === "reservation") {
    return (
      <PageView page="reservation">
        <ReservationSection />
        <NoticeSection />
      </PageView>
    );
  }

  return <HomeView />;
}
