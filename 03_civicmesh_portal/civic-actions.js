export const PUBLIC_PROGRAMS = [
  {
    id: "tech_bootcamp",
    title: "Municipal Python, SQL & Networking Certification",
    category: "Training",
    cost: "Free (100% Public)",
    min_age: 18,
    requires_student: false,
    requires_business: false,
    deadline: "2027-02-15",
    documents: ["National ID (front & back)", "Proof of local residence", "High school diploma or enrollment certificate"]
  },
  {
    id: "stem_scholarship",
    title: "Regional STEM & University Student Stipend",
    category: "Scholarship",
    cost: "Free Application",
    min_age: 17,
    requires_student: true,
    requires_business: false,
    deadline: "2027-01-30",
    documents: ["National ID", "Regular student certificate", "Academic transcript", "Bank account CBU/alias"]
  },
  {
    id: "micro_workshop_permit",
    title: "Fast-Track Micro-Enterprise & Workshop Permit",
    category: "Business Permit",
    cost: "Fee-waived first 12 months",
    min_age: 18,
    requires_student: false,
    requires_business: true,
    deadline: "Rolling (Year-round)",
    documents: ["Tax ID registration", "Workshop floor plan sketch", "Basic electrical safety declaration"]
  },
  {
    id: "digital_sme_grant",
    title: "Small Business Digitalization & E-Commerce Grant",
    category: "Grant",
    cost: "Non-reimbursable grant",
    min_age: 18,
    requires_student: false,
    requires_business: true,
    deadline: "2027-03-10",
    documents: ["Tax ID registration", "1-page digitalization plan", "Two vendor quotes"]
  }
];

export const CivicState = {
  savedPlans: [],
  listeners: [],
  subscribe(fn) { this.listeners.push(fn); },
  notify() { this.listeners.forEach(fn => fn(this)); },

  checkEligibility({ age = 25, is_student = false, has_small_business = false }) {
    const a = Number(age);
    const matched = PUBLIC_PROGRAMS.filter(p =>
      a >= p.min_age &&
      (!p.requires_student || is_student) &&
      (!p.requires_business || has_small_business)
    );
    return {
      ok: true,
      matched,
      privacy_note: "Evaluated 100% locally in your browser; zero personal data sent to any CivicMesh server.",
      summary: `${matched.length} matching program(s) found`
    };
  },

  preflightSavePlan({ program_id }) {
    const prog = PUBLIC_PROGRAMS.find(p => p.id === program_id);
    if (!prog) return { ok: false, reason: `Unknown program_id '${program_id}'.` };
    return {
      ok: true,
      dialogTitle: "Save Local Application Checklist",
      confirmLabel: "Save to My Browser",
      cancelLabel: "Don't Save",
      summaryRows: [
        ["Program", prog.title],
        ["Deadline", prog.deadline],
        ["Documents", prog.documents.join("; ")],
        ["Storage", "Browser localStorage only (private)"]
      ]
    };
  },

  savePlan({ program_id }) {
    const prog = PUBLIC_PROGRAMS.find(p => p.id === program_id);
    if (!prog) return { ok: false, reason: `Unknown program_id '${program_id}'.` };
    const plan = { ...prog, saved_at: new Date().toLocaleTimeString() };
    this.savedPlans.unshift(plan);
    this.notify();
    return { ok: true, plan, summary: `Saved checklist for ${prog.title}` };
  }
};
