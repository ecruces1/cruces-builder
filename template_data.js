const DEFAULT_RESUME_DATA = {
  header: {
    fullName: "YOUR FULL NAME",
    professionalTitle: "PROFESSIONAL TITLE / ROLE",
    phone: "0 123 456 789",
    email: "yourname@email.com",
    address: "address here",
    linkedin: "portfolio link /in/yourname",
    website: "www.yourwebsite.com"
  },
  summary: "Results-driven professional with 5+ years of experience in project coordination, customer service, and business operations. Strong communication, problem-solving, and organizational skills with a proven ability to improve efficiency and deliver high-quality results.",
  skills: [
    { col: 1, items: ["Project Management", "Customer Service", "Microsoft Office Suite", "Google Workspace"] },
    { col: 2, items: ["Data Analysis", "Time Management", "Team Collaboration", "Problem Solving"] },
    { col: 3, items: ["Written & Verbal Communication", "CRM Software", "Leadership", "Attention to Detail"] }
  ],
  experience: [
    {
      id: "exp-1",
      title: "Senior Administrative Assistant",
      company: "ABC Company",
      location: "New York, NY",
      dateRange: "Jan 2022 – Present",
      description: "Direct executive support, cross-department scheduling, and operational workflow oversight across 4 corporate divisions.",
      bullets: [
        "Managed executive calendars and coordinated meetings across multiple departments.",
        "Improved document management processes, reducing retrieval time by 30%.",
        "Prepared reports, presentations, and business correspondence.",
        "Maintained accurate records and confidential documentation.",
        "Assisted with onboarding and training of new employees."
      ]
    },
    {
      id: "exp-2",
      title: "Administrative Assistant",
      company: "XYZ Solutions",
      location: "New York, NY",
      dateRange: "Jun 2019 – Dec 2021",
      description: "Supported daily office operations, customer communications, and financial expense reconciliation.",
      bullets: [
        "Supported daily office operations and customer inquiries.",
        "Scheduled appointments and maintained office records.",
        "Processed invoices and expense reports accurately.",
        "Collaborated with cross-functional teams to improve workflow efficiency."
      ]
    }
  ],
  education: [
    {
      id: "edu-1",
      degree: "Bachelor of Business Administration (BBA)",
      institution: "University Name",
      dateRange: "Graduated: 2019"
    }
  ],
  certifications: [
    { id: "cert-1", name: "Google Project Management Professional Certificate" },
    { id: "cert-2", name: "Microsoft Office Specialist (MOS)" }
  ],
  achievements: [
    { id: "ach-1", text: "English (Fluent) • Spanish (Conversational)" },
    { id: "ach-2", text: "Employee of the Quarter (2023)" },
    { id: "ach-3", text: "Increased operational efficiency through process improvements." }
  ],
  settings: {
    theme: "illustrator",
    primaryColor: "#1C3A5E",
    accentColor: "#0B7A75",
    fontFamily: "Poppins",
    fontScale: 100,
    lineSpacing: 1.42,
    sectionTitles: {
      summary: "PROFESSIONAL SUMMARY",
      skills: "CORE SKILLS",
      experience: "PROFESSIONAL EXPERIENCE",
      education: "EDUCATION",
      certifications: "CERTIFICATIONS",
      achievements: "LANGUAGES & ACHIEVEMENTS"
    },
    sectionOrder: ["summary", "skills", "experience", "education", "certifications", "achievements"]
  }
};
