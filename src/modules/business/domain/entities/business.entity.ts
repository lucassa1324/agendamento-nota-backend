export type Business = {
  id: string;
  name: string;
  slug: string;
  config: any;
  userId: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  config: any;
  createdAt: Date;
};

export type CreateBusinessInput = {
  id: string;
  name: string;
  slug: string;
  userId: string;
  config: any;
};
