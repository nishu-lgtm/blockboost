export interface ProjectBasics {
  name: string;
  websiteUrl: string;
  brandName: string;
}

export interface PromptItem {
  id: string;
  text: string;
  category: string;
  selected: boolean;
  isCustom: boolean;
}

export interface CompetitorItem {
  id: string;
  brandName: string;
  websiteUrl: string;
}
