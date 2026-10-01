export type Task = 'explain' | 'review' | 'deps';

export interface Example {
  id: string;
  scenario: string;
  task: Task;
  system: string;
  instruction: string;
  input: string;
  output: string;
  check: Check;
}

export type Check =
  | { task: 'explain'; keywords: string[] }
  | { task: 'review'; issues: { line: number; severity: string }[] }
  | { task: 'deps'; commands: string[]; majors: string[] };

export type Vars = Record<string, string[]>;

export interface CrashScenario {
  id: string;
  files: Record<string, string>;
  run?: string;
  stderr?: string;
  cause: string;
  fix: string;
  why: string;
  prevent: string;
  keywords: string[];
  vars?: Vars;
}

export interface ReviewIssue {
  match: string;
  severity: 'high' | 'medium' | 'low';
  problem: string;
  fix: string;
}

export interface ReviewScenario {
  id: string;
  path: string;
  before: string;
  after: string;
  issues: ReviewIssue[];
  vars?: Vars;
}
