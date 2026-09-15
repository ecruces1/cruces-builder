// Synthetic Adversarial Resume Fixtures for Stress Testing and Proactive Diagnostics
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.STRESS_FIXTURES = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const baseState = {
    header: {
      fullName: "ALEXANDER V. THORNTON-MONTGOMERY III",
      professionalTitle: "PRINCIPAL ARCHITECT & TECHNICAL LEAD",
      phone: "+1 (555) 019-2834 / ext. 402",
      email: "alexander.thornton-montgomery@domain-solutions.enterprise.org",
      address: "1234 North West Innovation Boulevard, Suite 800, San Francisco, CA 94105",
      linkedin: "linkedin.com/in/alexander-thornton-montgomery-principal",
      website: "https://enterprise-architecture-systems-portfolio.tech"
    },
    summary: "Strategic, high-impact enterprise systems architect with 12+ years directing distributed software systems, cloud migrations, and high-throughput transactional infrastructure. Proven capability in engineering resilience, zero-downtime deployments, and cross-functional team mentorship.",
    skills: [
      { col: 1, items: ["Kubernetes & Cloud Native", "Distributed Architecture", "Enterprise Security", "TypeScript & Node.js"] },
      { col: 2, items: ["System Observability", "CI/CD Pipeline Automation", "Microservices Design", "High Availability / DR"] },
      { col: 3, items: ["Executive Stakeholder Comms", "Team Leadership & Hiring", "Data Governance & ATS", "FinOps & Cost Optimization"] }
    ],
    experience: [
      {
        id: "exp-1",
        title: "Principal Infrastructure Architect",
        company: "Global Enterprise Technologies Corp",
        location: "San Francisco, CA",
        dateRange: "Jan 2021 – Present",
        description: "Direct enterprise architecture strategy, cloud infrastructure modernization, and developer tooling across 12 distributed squads.",
        bullets: [
          "Spearheaded multi-region cloud resilience strategy delivering 99.995% uptime across 40M daily active requests.",
          "Cut infrastructure spending by $1.4M annually through dynamic autoscaling and automated container optimization.",
          "Led team of 18 senior systems engineers; modernized deployment cadences from monthly release trains to on-demand daily deploys.",
          "Architected real-time distributed telemetry pipeline handling 80,000 events/sec with Prometheus and Grafana."
        ]
      },
      {
        id: "exp-2",
        title: "Lead Cloud & Systems Engineer",
        company: "NextGen Cloud Solutions",
        location: "Seattle, WA",
        dateRange: "Mar 2017 – Dec 2020",
        description: "Spearheaded platform engineering initiatives, container orchestration, and automated infrastructure delivery.",
        bullets: [
          "Built zero-trust networking architecture across hybrid cloud environments satisfying SOC2 Type II compliance.",
          "Automated Terraform infrastructure provisioning reducing environment turn-up time from 3 weeks to 18 minutes.",
          "Championed chaos engineering drills to validate disaster recovery and failover SLAs under peak network loads."
        ]
      }
    ],
    education: [
      {
        id: "edu-1",
        degree: "Master of Science in Computer Science (Distributed Systems)",
        institution: "Stanford University",
        dateRange: "2015 – 2017"
      },
      {
        id: "edu-2",
        degree: "Bachelor of Science in Computer Engineering (Honors)",
        institution: "University of Washington",
        dateRange: "2011 – 2015"
      }
    ],
    certifications: [
      { id: "cert-1", name: "AWS Certified Solutions Architect – Professional (SAP-C02)" },
      { id: "cert-2", name: "Certified Kubernetes Administrator (CKA) – Linux Foundation" },
      { id: "cert-3", name: "HashiCorp Certified: Terraform Associate (003)" }
    ],
    achievements: [
      { id: "ach-1", text: "Speaker: Cloud Native Summit 2023 ('Architecting for Graceful Degradation')" },
      { id: "ach-2", text: "Recipient of Enterprise Innovation Award (2022)" },
      { id: "ach-3", text: "English (Native) • German (Conversational B2)" }
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
        skills: "CORE COMPETENCIES & TECHNICAL PROFICIENCIES",
        experience: "PROFESSIONAL WORK EXPERIENCE",
        education: "EDUCATION & ACADEMIC CREDENTIALS",
        certifications: "LICENSES & PROFESSIONAL CERTIFICATIONS",
        achievements: "LANGUAGES, HONORS & KEY ACHIEVEMENTS"
      },
      sectionOrder: ["summary", "skills", "experience", "education", "certifications", "achievements"]
    }
  };

  // Test Case 1: Extreme Lengths & Unbroken Strings (Tests flex wrapping, overflow-wrap, and max-width)
  const extremeLengths = JSON.parse(JSON.stringify(baseState));
  extremeLengths.header.fullName = "DR. ALEXANDER-BARTHOLOMEW VON-HOFFENHEIM-WORTHINGTON-CHANDLER IV";
  extremeLengths.header.professionalTitle = "CHIEF EXECUTIVE PRINCIPAL GLOBAL ENTERPRISE ARCHITECT & MULTI-CLOUD INFRASTRUCTURE STRATEGIST";
  extremeLengths.header.website = "https://subdomain.very-long-domain-name-with-absolutely-no-hyphens-or-spaces-that-keeps-going-and-going.engineering.solutions.international/portfolio/index.html?ref=tracking_token_1234567890_abcdefghijklmnopqrstuvwxyz";
  extremeLengths.header.email = "alexander.bartholomew.von-hoffenheim-worthington-chandler@enterprise-distributed-systems-consulting.co.uk";
  extremeLengths.summary = "Extremely long narrative paragraph without paragraph breaks designed to evaluate line-height fidelity and vertical rhythm when a user pastes a comprehensive multi-hundred word summary directly from an old academic curriculum vitae: " +
    "Directing global architectural transformations across hybrid cloud fabrics requires synthesizing strategic executive mandates with rigorous engineering controls. Over twelve years across telecommunications, algorithmic trading, and multinational e-commerce platforms, demonstrated repeatable methodologies for risk mitigation, latency minimization, and high-concurrency event-stream processing. Managed operating expenditure profiles exceeding thirty million dollars while continuously upgrading platform resilience and reducing total cost of ownership across distributed autonomous engineering clusters. ".repeat(2);
  extremeLengths.experience[0].bullets[0] = "Spearheaded complete migration of ultra-high-throughput monolith into 45 autonomous microservices while maintaining continuous 99.999% SLA adherence: https://internal.monitoring.dashboard.enterprise.internal/reports/annual-systems-performance-metrics-archive-2023-final-consolidated-version.pdf with unbroken hyperlinks and zero visual clipping.";
  extremeLengths.skills[0].items = [
    "Ultra-Long-Skill-Name-Without-Spaces-To-Verify-Ellipsis-Or-Wrap-Behavior-In-Columns",
    "Continuous Integration / Continuous Delivery / Continuous Deployment",
    "Enterprise-Grade-Zero-Trust-Multi-Region-Mesh-Architecture"
  ];

  // Test Case 2: Boundary Split (Calibrated right on the 1-to-2 page threshold)
  const boundarySplit = JSON.parse(JSON.stringify(baseState));
  boundarySplit.summary = "A calibrated summary of moderate length designed to test pagination triggers at the exact boundary of 8.5x11 inch paper dimensions.";
  boundarySplit.experience = [
    {
      id: "exp-1",
      title: "Senior Technical Lead",
      company: "Acme Corp",
      location: "San Jose, CA",
      dateRange: "2020 – Present",
      description: "Leadership and architecture across critical microservices.",
      bullets: [
        "Delivered microservices modernization project on schedule and 15% under budget.",
        "Authored RFCs for cross-team event streaming architecture.",
        "Mentored 6 associate engineers and instituted automated code review guidelines."
      ]
    },
    {
      id: "exp-2",
      title: "Software Engineer III",
      company: "Beta Systems",
      location: "Austin, TX",
      dateRange: "2018 – 2020",
      description: "Full-stack feature delivery and automated testing.",
      bullets: [
        "Rewrote billing pipeline eliminating 98% of timeout exceptions.",
        "Target boundary bullet #1: This bullet point is positioned near the bottom threshold of Page 1.",
        "Target boundary bullet #2: Evaluating whether this triggers clean split or orphaned header."
      ]
    }
  ];

  // Test Case 3: Sparse & Missing Fields (Tests resilience against null/empty strings/omitted fields)
  const sparseEmpty = {
    header: {
      fullName: "JANE DOE",
      professionalTitle: "",
      phone: "",
      email: "jane.doe@example.com",
      address: "",
      linkedin: "",
      website: ""
    },
    summary: "",
    skills: [
      { col: 1, items: [] },
      { col: 2, items: [] },
      { col: 3, items: [] }
    ],
    experience: [],
    education: [
      {
        id: "edu-1",
        degree: "B.S. General Studies",
        institution: "State College",
        dateRange: ""
      }
    ],
    certifications: [],
    achievements: [],
    settings: {
      theme: "monochrome",
      primaryColor: "#000000",
      accentColor: "#111111",
      fontFamily: "Inter",
      fontScale: 100,
      lineSpacing: 1.35,
      sectionTitles: {
        summary: "SUMMARY",
        skills: "SKILLS",
        experience: "EXPERIENCE",
        education: "EDUCATION",
        certifications: "CERTIFICATIONS",
        achievements: "ACHIEVEMENTS"
      },
      sectionOrder: ["summary", "skills", "experience", "education", "certifications", "achievements"]
    }
  };

  // Test Case 4: Special Characters & HTML Injections (Tests XSS prevention, smart quotes, accents, emojis)
  const specialCharacters = JSON.parse(JSON.stringify(baseState));
  specialCharacters.header.fullName = "JOSÉ RAÚL CAPABLANCA & RENÉE D'AOUST <script>alert(1)</script>";
  specialCharacters.header.professionalTitle = "VP of Engineering 🚀 | AI/ML & DevSecOps \"Expert\" • 100% Proven";
  specialCharacters.header.address = "Rue de l'Avenir 42, 1000 Bruxelles — Belgium / México City (MX)";
  specialCharacters.summary = "“Award-winning” executive consultant with 15+ years experience: «Specialized in cutting-edge systems, high-growth startups & Fortune 500 integrations». Features smart quotes (“ ”), em-dashes (—), en-dashes (–), mathematical notation (∑ f(x) ≤ ∞), and accented vowels (á, é, í, ó, ú, ñ, ü, ø, å). Safe against raw HTML tags: <b>Bold</b>, <i>Italics</i>, <img src=x onerror=alert('xss')>.";
  specialCharacters.skills[0].items = [
    "JavaScript (ES6+) & Web APIs",
    "C++ / C# / .NET Core",
    "SQL (PostgreSQL & MySQL)",
    "HTML5 & CSS3 Variables"
  ];
  specialCharacters.achievements[0].text = "Languages: Français (Courant) • Español (Nativo) • English (Fluent) • 日本語 (JLPT N3)";
  specialCharacters.achievements[1].text = "⭐ Top Rated Contributor & Patent Holder: US-9482710-B2";

  // Test Case 5: Multi-Page Overflow (4 full pages of detailed career history)
  const multiPageOverflow = JSON.parse(JSON.stringify(baseState));
  multiPageOverflow.experience = [];
  const roles = [
    { title: "Senior VP of Technology", company: "Omega Holdings", dates: "2022 – Present", count: 5 },
    { title: "VP of Engineering", company: "Vertex Cloud Systems", dates: "2019 – 2022", count: 5 },
    { title: "Director of Software Engineering", company: "Horizon Media", dates: "2016 – 2019", count: 4 },
    { title: "Lead Systems Architect", company: "DataPulse Analytics", dates: "2013 – 2016", count: 4 },
    { title: "Senior Software Engineer", company: "Core Networks", dates: "2010 – 2013", count: 4 },
    { title: "Software Engineer", company: "FirstStep Interactive", dates: "2007 – 2010", count: 3 }
  ];

  roles.forEach((r, idx) => {
    const bullets = [];
    for (let b = 1; b <= r.count; b++) {
      bullets.push(`Delivered major strategic milestone #${b} improving operational efficiency, platform scalability, and automated testing coverage across multi-region production clusters.`);
    }
    multiPageOverflow.experience.push({
      id: `exp-${idx + 1}`,
      title: r.title,
      company: r.company,
      location: "San Francisco, CA",
      dateRange: r.dates,
      description: `Executive leadership and operational oversight for enterprise engineering teams supporting tier-1 production systems.`,
      bullets: bullets
    });
  });

  multiPageOverflow.education.push({
    id: "edu-3",
    degree: "Executive Leadership Program Certificate",
    institution: "MIT Sloan School of Management",
    dateRange: "2020"
  });

  return {
    extreme_lengths: {
      name: "Extreme Text & Long URLs",
      description: "Massive titles, 100+ character unbroken strings, and huge paragraphs to test text wrapping and flex column integrity.",
      data: extremeLengths
    },
    boundary_split: {
      name: "Boundary Split (1 vs 2 Pages)",
      description: "Content calibrated right at the 1012px threshold to test pagination split oscillation and orphan header prevention.",
      data: boundarySplit
    },
    sparse_empty: {
      name: "Sparse & Empty Fields",
      description: "Tests defensive rendering when optional fields, contacts, summaries, skills, and experiences are blank or empty arrays.",
      data: sparseEmpty
    },
    special_characters: {
      name: "Special Characters, Accents & XSS",
      description: "Smart quotes, em-dashes, multilingual accents, emojis, and raw HTML tags to test character fidelity and injection safety.",
      data: specialCharacters
    },
    multi_page_overflow: {
      name: "Multi-Page Deep CV (4+ Pages)",
      description: "Extensive career history spanning 6 roles and 25+ detailed bullet points to test multi-page distribution.",
      data: multiPageOverflow
    }
  };
});
