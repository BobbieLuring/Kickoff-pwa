export type SectionStatus = 'soon' | 'open' | 'closed';

export interface SectionSummary {
  title: string;
  path: string;
  status?: SectionStatus;
}

export interface HomeSummary {
  playerName: string;
  points: number;
  rank: number;
  pointsBehindLeader: number;
  sections: SectionSummary[];
}