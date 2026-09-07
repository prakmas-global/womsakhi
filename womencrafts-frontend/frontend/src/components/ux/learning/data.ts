/**
 * Learning content, shaped like what the API already returns.
 *
 * `apiMyPrograms`, `apiCatalogPrograms`, `apiMyProgress` and `apiLibrary` exist
 * and work today — these mirror their fields, so wiring the screens to live data
 * is a swap of the source rather than a rewrite of any component.
 */

export interface Course {
  id: string; title: string; lessons: number; level: string;
  rating: string; count: string; pct?: number; thumb: string;
  tag?: "Bestseller" | "New" | "Popular" | "Trending";
  category: string; hours?: string; author?: string;
}

export const CONTINUING: Course[] = [
  { id: "dm-basics", title: "Digital Marketing Basics", lessons: 12, level: "Beginner", rating: "4.8", count: "1.2k",
    pct: 60, thumb: "/ux/art/course-working-laptop-smiling.webp", category: "Digital", hours: "6h", author: "Neha Verma" },
  { id: "comm-skills", title: "Communication Skills for Women", lessons: 10, level: "Beginner", rating: "4.6", count: "732",
    pct: 30, thumb: "/ux/art/course-confident-microphone.webp", category: "Personal", hours: "5h", author: "Anita Rao" },
  { id: "fin-lit", title: "Financial Literacy Essentials", lessons: 8, level: "Beginner", rating: "4.9", count: "980",
    pct: 40, thumb: "/ux/art/course-counting-coins-calculator.webp", category: "Money", hours: "4h", author: "Kavita Shah" },
];

export const TOP_PICKS: Course[] = [
  { id: "dm-mastery", title: "Digital Marketing Mastery", lessons: 12, level: "Beginner", rating: "4.8", count: "1.2K",
    thumb: "/ux/art/course-reviewing-tablet-charts.webp", tag: "Bestseller", category: "Digital", hours: "7h" },
  { id: "web-dev", title: "Web Development Basics", lessons: 10, level: "Beginner", rating: "4.7", count: "856",
    thumb: "/ux/art/course-writing-notebook.webp", tag: "New", category: "Technology", hours: "8h" },
  { id: "comm", title: "Communication Skills", lessons: 8, level: "Intermediate", rating: "4.6", count: "732",
    thumb: "/ux/art/course-presenting-to-group.webp", tag: "Popular", category: "Personal", hours: "5h" },
  { id: "mindful", title: "Mindfulness & Well-being", lessons: 6, level: "All Levels", rating: "4.8", count: "1.5K",
    thumb: "/ux/art/course-meditation.webp", tag: "Trending", category: "Health", hours: "3h" },
  { id: "excel", title: "Excel for Professionals", lessons: 9, level: "Beginner", rating: "4.7", count: "640",
    thumb: "/ux/art/course-presenting-to-group.webp", category: "Career", hours: "6h" },
  { id: "brand", title: "Personal Branding 101", lessons: 7, level: "Beginner", rating: "4.6", count: "410",
    thumb: "/ux/art/course-photographing-handmade-product.webp", category: "Career", hours: "4h" },
  { id: "speak", title: "Public Speaking Confidently", lessons: 6, level: "Beginner", rating: "4.8", count: "512",
    thumb: "/ux/art/course-confident-microphone.webp", category: "Personal", hours: "3h" },
  { id: "time", title: "Time Management Mastery", lessons: 8, level: "Beginner", rating: "4.7", count: "388",
    thumb: "/ux/art/course-teaching-another-woman.webp", category: "Personal", hours: "4h" },
];

export const PATHS = [
  { id: "career", name: "Career Growth Path", courses: 8, lessons: 32, pct: 60,
    body: "Advance your career with in-demand skills and knowledge.",
    icon: "Briefcase", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "money", name: "Financial Freedom Path", courses: 6, lessons: 24, pct: 40,
    body: "Learn to manage, invest and grow your money.",
    icon: "BadgeIndianRupee", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "founder", name: "Entrepreneur Path", courses: 7, lessons: 28, pct: 20,
    body: "Build, launch and scale your dream business.",
    icon: "Rocket", tint: "--ux-tint-pink", ink: "--ux-pink" },
];

export const SKILLS = [
  { name: "Social Media Marketing", level: "Beginner", icon: "Megaphone", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { name: "Graphic Design", level: "Beginner", icon: "Palette", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { name: "Excel for Professionals", level: "Beginner", icon: "Table2", tint: "--ux-tint-green", ink: "--ux-green" },
  { name: "Photography", level: "Intermediate", icon: "Camera", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { name: "Content Writing", level: "Beginner", icon: "PenLine", tint: "--ux-tint-blue", ink: "--ux-blue" },
];

export const INTERESTS = [
  { name: "Digital Marketing", icon: "Megaphone", tone: "brand" },
  { name: "Career Growth", icon: "TrendingUp", tone: "green" },
  { name: "Financial Freedom", icon: "BadgeIndianRupee", tone: "orange" },
  { name: "Communication", icon: "MessageCircle", tone: "blue" },
  { name: "Personal Development", icon: "Heart", tone: "pink" },
] as const;

export const ACHIEVEMENTS = [
  { name: "Quick Learner", body: "Complete 3 lessons", img: "/ux/vector/badge-quick-learner.svg" },
  { name: "Goal Getter", body: "Achieve a learning goal", img: "/ux/vector/badge-goal-getter.svg" },
  { name: "Rising Star", body: "Reach Level 4", img: "/ux/vector/badge-rising-star.svg" },
];

export const CERTIFICATES = [
  { id: "c1", title: "Beauty & Salon Skills", issued: "12 Mar 2026", code: "WS-BS-2291", tone: "pink" },
  { id: "c2", title: "Home Bakery Business", issued: "04 Feb 2026", code: "WS-HB-1877", tone: "orange" },
  { id: "c3", title: "Digital Skills for Women", issued: "19 Dec 2025", code: "WS-DS-1450", tone: "violet" },
  { id: "c4", title: "Handicrafts Mastery", issued: "28 Oct 2025", code: "WS-HM-1122", tone: "green" },
] as const;

export const STREAK = { days: 7, marks: [true, true, true, true, true, true, false] };
export const LEARNER = { name: "Sakhi", level: 4, title: "Rising Star", xp: 1250, xpMax: 2000 };
export const CATEGORIES = ["All", "Digital", "Career", "Money", "Personal", "Technology", "Health"];
