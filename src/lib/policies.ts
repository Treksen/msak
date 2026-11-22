import announcements from "../data/policies/announcements.json";
import community from "../data/policies/community.json";
import leadership from "../data/policies/leadership.json";
import membership from "../data/policies/membership.json";
import privacy from "../data/policies/privacy.json";
import terms from "../data/policies/terms.json";

export type PolicyDocument = {
  title: string;
  version: string;
  lastUpdated: string;
  description: string;
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
};

/** Policy texts live in src/data/policies/*.json — edit there and redeploy. */
export const policies: Record<string, PolicyDocument> = {
  terms,
  privacy,
  membership,
  leadership,
  announcements,
  community,
};

export const policyList = Object.entries(policies).map(([slug, doc]) => ({ slug, title: doc.title, description: doc.description }));
