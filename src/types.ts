// Matches the shape returned by the templates JOIN query (categories aggregated into a slug array)
export interface TemplateRow {
  id: string;
  title: string;
  source: Record<string, unknown>;
  order_index: number;
  created_at: Date;
  updated_at: Date;
  categories: string[]; // slugs, e.g. ["minimal", "modern"]
}

export interface CategoryRow {
  id: number;
  slug: string;
}

// Request body for POST /templates
export interface CreateTemplateBody {
  id: string;
  title: string;
  source: Record<string, unknown>;
  order_index?: number;   // defaults to 0 if omitted
  categories?: string[];  // existing category slugs to link
}

// All fields are optional — caller must provide at least one (enforced in the route)
export interface UpdateTemplateBody {
  title?: string;
  source?: Record<string, unknown>;
  order_index?: number;
}

// Request body for POST /categories
export interface CreateCategoryBody {
  slug: string;
}
