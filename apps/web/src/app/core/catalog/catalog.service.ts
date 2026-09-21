import { Injectable, inject } from '@angular/core';
import type { Category, CourseQuery, CourseSummary, Paginated } from '@manako/shared';
import { ApiClient } from '../http/api-client.service';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiClient);

  getCourses(query: CourseQuery) {
    return this.api.get<Paginated<CourseSummary>>('/courses', {
      search: query.search,
      category: query.category,
      level: query.level,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit ?? 12,
    });
  }

  getFeatured(limit = 8) {
    return this.api.get<CourseSummary[]>('/courses/featured', { limit });
  }

  getCategories() {
    return this.api.get<Category[]>('/courses/categories');
  }
}
