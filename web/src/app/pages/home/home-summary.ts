import { SectionStatus } from '../../room-sections';

export interface SectionSummary {
  title: string;
  path: string;
  status: SectionStatus;
}

export interface HomeSummary {
  playerName: string;
  points: number;
  rank: number;
  pointsBehindLeader: number;
  sections: SectionSummary[];
}