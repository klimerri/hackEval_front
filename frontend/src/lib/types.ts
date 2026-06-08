export type Role = 'participant' | 'jury' | 'organizer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  company?: string | null;
  specialization?: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type HackathonStatus = 'draft' | 'active' | 'finished';

export interface Hackathon {
  id: number;
  title: string;
  description: string;
  rules: string[];
  start_date: string;
  end_date: string;
  submission_deadline: string;
  status: HackathonStatus;
  prize_pool: string;
  image_url: string;
  type: string;
  coefficients: Record<string, number>;
  jury_criteria: Criterion[];
  presentation_sections: PresentationSection[];
  max_team_size: number;
  organizer_id: number;
  teams_count: number;
  jury_count: number;
}

export interface Criterion {
  key: string;
  label: string;
  weight: number;
}

export interface PresentationSection {
  key: string;
  label: string;
  keywords: string[];
}

export type TeamStatus = 'pending' | 'approved' | 'rejected';
export type TeamMemberRole = 'captain' | 'member';

export interface TeamMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: TeamMemberRole;
}

export interface Team {
  id: number;
  name: string;
  hackathon_id: number;
  status: TeamStatus;
  invite_code: string;
  github_url: string | null;
  docs_url: string | null;
  presentation_url: string | null;
  video_url: string | null;
  notes: string;
  has_archive: boolean;
  has_doc_file: boolean;
  has_presentation_file: boolean;
  has_video_file: boolean;
  applied_at: string;
  decided_at: string | null;
  members: TeamMember[];
}

export type CheckStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface CodeCheckRaw {
  nn_readme: number | null;
  nn_license: number | null;
  nn_deps: number | null;
  nn_run: number | null;
  nn_code_quality: number | null;
}

export interface CodeCheck {
  status: CheckStatus;
  score: number;
  has_readme: boolean;
  has_license: boolean;
  has_deps_file: boolean;
  has_run_instructions: boolean;
  loc: number;
  avg_complexity: number;
  lint_issues: number;
  secrets_found: number;
  nn_quality_score: number | null;
  raw: CodeCheckRaw;
  message: string;
}

export interface DocCheck {
  status: CheckStatus;
  score: number;
  word_count: number;
  has_description: boolean;
  has_deploy: boolean;
  has_usage: boolean;
  image_count: number;
  fmt: string;
  message: string;
}

export interface PresentationCheck {
  status: CheckStatus;
  score: number;
  slide_count: number;
  sections_found: string[];
  fmt: string;
  message: string;
}

export interface VideoCheck {
  status: CheckStatus;
  score: number;
  duration_sec: number;
  width: number;
  height: number;
  codec: string;
  transcription: string;
  summary: string;
  message: string;
}

export type SubmissionStatus = 'pending' | 'evaluating' | 'evaluated' | 'error';

export interface Submission {
  id: number;
  team_id: number;
  status: SubmissionStatus;
  auto_score: number;
  jury_score: number | null;
  final_score: number;
  rank: number | null;
  created_at: string;
  finished_at: string | null;
  code_check: CodeCheck | null;
  doc_check: DocCheck | null;
  presentation_check: PresentationCheck | null;
  video_check: VideoCheck | null;
}

export interface TeamResult {
  team_id: number;
  team_name: string;
  hackathon_id: number;
  status: string;
  auto_score: number;
  jury_score: number | null;
  final_score: number;
  rank: number | null;
}

export interface Winner {
  rank: number;
  team_id: number;
  team_name: string;
  final_score: number;
}

export interface DashboardStats {
  active_hackathons: number;
  my_teams: number;
  total_submissions: number;
  pending_evaluations: number;

  assigned_hackathons: number;
  teams_to_grade: number;
  graded_by_me: number;

  managed_hackathons: number;
  total_teams: number;
  pending_teams: number;
  jury_total: number;
}

export interface DashboardHackathonRow {
  id: number;
  title: string;
  status: string;
  deadline: string;
  team: string;
  score: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

export interface Dashboard {
  role: Role;
  stats: DashboardStats;
  my_hackathons: DashboardHackathonRow[];
  announcements: Announcement[];
}

export interface AssignedJury {
  id: number;
  name: string;
  email: string;
  company?: string | null;
  specialization?: string | null;
}

export interface OrgTeam {
  id: number;
  name: string;
  status: TeamStatus;
  hackathon_id: number;
  hackathon_title: string;
  github_url: string | null;
  applied_at: string | null;
  members: TeamMember[];
}

export interface JuryHackathon {
  id: number;
  title: string;
  teams_count: number;
  graded_count: number;
  deadline: string;
  status: string;
}

export interface JuryCheckCode {
  status: string;
  score: number | null;
  loc: number;
  lint_issues: number;
  secrets_found: number;
  has_readme: boolean;
}
export interface JuryCheckDoc {
  status: string;
  score: number | null;
  word_count: number;
  fmt: string;
}
export interface JuryCheckPresentation {
  status: string;
  score: number | null;
  slide_count: number;
  fmt: string;
}
export interface JuryCheckVideo {
  status: string;
  score: number | null;
  duration_sec: number;
  summary: string;
}
export interface JuryChecks {
  code: JuryCheckCode;
  doc: JuryCheckDoc;
  presentation: JuryCheckPresentation;
  video: JuryCheckVideo;
}

export interface JuryTeam {
  id: number;
  name: string;
  captain: string;
  auto_score: number;
  github: string | null;
  docs: string | null;
  video: string | null;
  presentation: string | null;
  status: 'evaluated' | 'pending';
  checks: JuryChecks | null;
  my_score: { scores: Record<string, number>; comment: string } | null;
}

export type NotificationType =
  | 'join_request'
  | 'join_decision'
  | 'team_decision'
  | 'team_removed'
  | 'kicked'
  | 'info';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  unread: number;
  items: AppNotification[];
}

export interface JuryPoolUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  company?: string | null;
  specialization?: string | null;
}

export interface OrganizerAnalytics {
  participation: { id: number; title: string; students: number; approved: number }[];
  total_applications: number;
  avg_score: number;
  active_jury: number;
  prize_pool_total: string;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequestOut {
  id: number;
  team_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  status: JoinRequestStatus;
  message: string;
  created_at: string;
  decided_at: string | null;
}

export type AlgoLang = 'python' | 'cpp' | 'java';
export type Verdict = 'OK' | 'WA' | 'TL' | 'ML' | 'RE' | 'CE' | 'PENDING' | 'RUNNING';

export interface AlgorithmTask {
  id: number;
  hackathon_id: number;
  title: string;
  statement: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  language: AlgoLang;
  created_at: string;
  test_count: number;
}

export interface AlgorithmSubmissionTest {
  id: number;
  test_id: number;
  verdict: Verdict;
  runtime_ms: number;
  memory_mb: number;
  output: string;
  log: string;
}

export interface AlgorithmSubmission {
  id: number;
  task_id: number;
  user_id: number;
  language: AlgoLang;
  verdict: Verdict;
  runtime_ms: number;
  memory_mb: number;
  log: string;
  created_at: string;
  results: AlgorithmSubmissionTest[];
}
