# Category Module Documentation

## Overview

The Category Module is a complete CRUD (Create, Read, Update, Delete) implementation for managing product categories in the AI POS system. It includes server-side pagination, search, sorting, and real-time toast notifications.

## Table of Contents

1. [Architecture](#architecture)
2. [File Structure](#file-structure)
3. [API Endpoints](#api-endpoints)
4. [Redux State Management](#redux-state-management)
5. [Components](#components)
6. [Features](#features)
7. [Usage Examples](#usage-examples)
8. [Configuration](#configuration)

---

## Architecture

The Category Module follows a feature-based architecture pattern using Redux Toolkit for state management:

```
src/
├── features/
│   └── categories/
│       ├── categoriesAPI.js      # API service layer
│       └── categoriesSlice.js    # Redux slice with async thunks
├── routes/
│   └── category/
│       ├── index.jsx             # List/Index page
│       ├── add.jsx               # Create page
│       └── edit.jsx              # Edit page
└── config/
    └── apiConfig.js              # Global API configuration
```

---

## File Structure

### 1. API Service Layer (`src/features/categories/categoriesAPI.js`)

Handles all HTTP requests to the backend API. Uses the global `API_BASE_URL` from `apiConfig.js`.

**Functions:**

- `fetchCategoriesRequest(params)` - Fetch paginated list with search and sort
- `fetchCategoryByIdRequest(categoryId)` - Fetch single category by ID
- `createCategoryRequest(categoryData)` - Create new category
- `updateCategoryRequest(categoryId, categoryData)` - Update existing category
- `deleteCategoryRequest(categoryId)` - Delete category

**Authentication:**

- Automatically includes Bearer token from `localStorage.getItem('authToken')` in request headers

**Pagination:**

- Converts frontend `page` parameter to backend `skip` parameter
- Handles multiple response formats for backward compatibility

### 2. Redux Slice (`src/features/categories/categoriesSlice.js`)

Manages application state using Redux Toolkit.

**Async Thunks:**

- `fetchCategories(params)` - Fetch categories list
- `fetchCategoryById(categoryId)` - Fetch single category
- `createCategory(categoryData)` - Create category
- `updateCategory({ categoryId, categoryData })` - Update category
- `deleteCategory(categoryId)` - Delete category

**State Structure:**

```javascript
{
  status: 'idle' | 'loading' | 'succeeded' | 'failed',
  list: [],                    // Array of categories
  error: null,                 // Error message
  currentCategory: null,       // Currently viewed/edited category
  fetchStatus: 'idle',         // Status for single category fetch
  fetchError: null,
  updateStatus: 'idle',        // Status for update operation
  updateError: null,
  deleteStatus: 'idle',        // Status for delete operation
  deleteError: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  },
  search: '',                  // Search term
  sort: {
    sortBy: null,              // Field name to sort by
    sortOrder: 'asc'           // 'asc' or 'desc'
  }
}
```

**Reducers:**

- `setSearch(term)` - Set search term and reset to page 1
- `setPage(page)` - Set current page
- `setLimit(limit)` - Set items per page and reset to page 1
- `setSort({ sortBy, sortOrder })` - Set sort field and order
- `clearDeleteStatus()` - Clear delete operation status
- `clearUpdateStatus()` - Clear update operation status
- `clearCurrentCategory()` - Clear current category data

### 3. Components

#### Category List (`src/routes/category/index.jsx`)

**Features:**

- Server-side pagination (10, 25, 50, 100 items per page)
- Real-time search with 500ms debounce
- Sortable columns (click to sort, double-click to clear)
- Delete with confirmation dialog
- Toast notifications for success/error
- Responsive table layout

**Sortable Columns:**

- Name
- Slug
- Status (isActive)
- Created At
- Last Updated At

**Pagination Controls:**

- First, Previous, Next, Last buttons
- Current page indicator
- Items per page selector
- Display range (e.g., "Showing 1 to 10 of 50 entries")

#### Category Add (`src/routes/category/add.jsx`)

**Features:**

- Form validation
- Auto-generated slug from name
- Manual slug editing
- Success/error toast notifications
- Auto-redirect to list after successful creation

**Form Fields:**

- **Name** (required) - Category name
- **Slug** (required) - URL-friendly identifier (auto-generated)
- **Description** (optional) - Category description

**Validation:**

- Name: Required, non-empty
- Slug: Required, lowercase letters, numbers, and hyphens only

#### Category Edit (`src/routes/category/edit.jsx`)

**Features:**

- Loads existing category data
- Pre-populated form fields
- Same validation as Add form
- Loading state while fetching data
- Error state if fetch fails
- Success/error toast notifications
- Auto-redirect to list after successful update

**Form Fields:**

- Same as Add form
- Slug auto-updates when name changes (if slug was auto-generated)

---

## API Endpoints

All endpoints use the base URL from `src/config/apiConfig.js` (default: `http://localhost:8000/api`).

### Get All Categories (Paginated)

```
GET /category/get-all-active?skip=0&limit=10&search=term&sortBy=name&sortOrder=asc
```

**Query Parameters:**

- `skip` - Number of records to skip (calculated from page)
- `limit` - Number of records per page
- `search` - Search term (optional)
- `sortBy` - Field name to sort by (optional)
- `sortOrder` - 'asc' or 'desc' (optional)

**Response Format:**

```json
{
  "data": [...],
  "pagination": {
    "total": 50,
    "count": 10,
    "skip": 0,
    "limit": 10
  }
}
```

### Get Category by ID

```
GET /category/get/:categoryId
```

**Response:**

```json
{
  "data": {
    "_id": "...",
    "name": "Category Name",
    "slug": "category-slug",
    "description": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Create Category

```
POST /category/create
```

**Request Body:**

```json
{
  "name": "Category Name",
  "slug": "category-slug",
  "description": "Optional description"
}
```

### Update Category

```
PATCH /category/update/:categoryId
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "slug": "updated-slug",
  "description": "Updated description"
}
```

### Delete Category

```
DELETE /category/delete/:categoryId
```

---

## Redux State Management

### Dispatching Actions

**Fetch Categories:**

```javascript
import { useDispatch } from 'react-redux';
import { fetchCategories } from '../features/categories/categoriesSlice';

const dispatch = useDispatch();
dispatch(fetchCategories({ page: 1, limit: 10, search: 'term', sortBy: 'name' }));
```

**Create Category:**

```javascript
import { createCategory } from '../features/categories/categoriesSlice';

dispatch(createCategory({ name: 'New Category', slug: 'new-category' }))
  .unwrap()
  .then(() => {
    // Success
  })
  .catch((error) => {
    // Error handling
  });
```

**Update Category:**

```javascript
import { updateCategory } from '../features/categories/categoriesSlice';

dispatch(
  updateCategory({
    categoryId: '123',
    categoryData: { name: 'Updated Name' },
  })
)
  .unwrap()
  .then(() => {
    // Success
  });
```

**Delete Category:**

```javascript
import { deleteCategory } from '../features/categories/categoriesSlice';

dispatch(deleteCategory('123'))
  .unwrap()
  .then(() => {
    // Success
  });
```

### Accessing State

```javascript
import { useSelector } from 'react-redux';

const {
  list, // Array of categories
  status, // 'idle' | 'loading' | 'succeeded' | 'failed'
  error, // Error message
  pagination, // { page, limit, total, totalPages }
  search, // Current search term
  sort, // { sortBy, sortOrder }
  deleteStatus, // Delete operation status
  updateStatus, // Update operation status
  currentCategory, // Currently viewed category
  fetchStatus, // Single category fetch status
} = useSelector((state) => state.categories);
```

---

## Features

### 1. Server-Side Pagination

- Efficient handling of large datasets
- Configurable items per page (10, 25, 50, 100)
- Page navigation controls
- Automatic page reset on search/sort/filter changes

### 2. Real-Time Search

- Debounced search input (500ms delay)
- Server-side search implementation
- Search term stored in Redux state
- Automatic pagination reset on new search

### 3. Column Sorting

- Click column header to sort
- Double-click to clear sorting
- Visual indicators (sort icons)
- Server-side sorting
- Toggle between ascending/descending

### 4. Toast Notifications

- Success toasts for create/update/delete
- Error toasts with specific error messages
- Bootstrap Toast API with fallback
- Auto-dismiss after 5 seconds
- Timestamp display

### 5. Form Validation

- Client-side validation
- Real-time error feedback
- Required field indicators
- Slug format validation (lowercase, numbers, hyphens only)

### 6. Auto-Generated Slugs

- Automatic slug generation from category name
- Manual override capability
- Slug format: lowercase, alphanumeric, hyphens only
- Auto-updates when name changes (if slug was auto-generated)

---

## Usage Examples

### Basic List View

```javascript
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../features/categories/categoriesSlice';

const CategoryList = () => {
  const dispatch = useDispatch();
  const { list, status, pagination } = useSelector((state) => state.categories);

  useEffect(() => {
    dispatch(
      fetchCategories({
        page: pagination.page,
        limit: pagination.limit,
      })
    );
  }, [dispatch, pagination.page, pagination.limit]);

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'failed') return <div>Error loading categories</div>;

  return (
    <div>
      {list.map((category) => (
        <div key={category._id}>{category.name}</div>
      ))}
    </div>
  );
};
```

### Search Implementation

```javascript
import { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { setSearch } from '../features/categories/categoriesSlice';

const SearchBar = () => {
  const dispatch = useDispatch();
  const searchTimeoutRef = useRef(null);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        dispatch(setSearch(value));
      }, 500);
    },
    [dispatch]
  );

  return <input type="text" onChange={handleSearchChange} />;
};
```

### Sort Implementation

```javascript
import { useDispatch, useSelector } from 'react-redux';
import { setSort } from '../features/categories/categoriesSlice';

const SortableHeader = ({ columnName }) => {
  const dispatch = useDispatch();
  const { sort } = useSelector((state) => state.categories);

  const handleSort = (isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
    } else {
      const newOrder = sort.sortBy === columnName && sort.sortOrder === 'asc' ? 'desc' : 'asc';
      dispatch(setSort({ sortBy: columnName, sortOrder: newOrder }));
    }
  };

  return (
    <th onClick={() => handleSort(false)} onDoubleClick={() => handleSort(true)}>
      {columnName}
    </th>
  );
};
```

---

## Configuration

### API Base URL

The API base URL is configured in `src/config/apiConfig.js`:

```javascript
export const API_BASE_URL = 'http://localhost:8000/api';
```

To change the API endpoint, update this file. All API calls will automatically use the new URL.

### Default Pagination

Default pagination settings are in `categoriesSlice.js`:

```javascript
pagination: {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0
}
```

### Search Debounce

Search debounce delay is set in `src/routes/category/index.jsx`:

```javascript
setTimeout(() => {
  dispatch(setSearch(value));
}, 500); // 500ms debounce
```

### Sort Click Delay

Sort click detection delay is set in `src/routes/category/index.jsx`:

```javascript
setTimeout(() => {
  dispatch(setSort({ sortBy }));
}, 200); // 200ms delay for double-click detection
```

---

## Routes

The category routes are configured in `src/App.jsx`:

- `/categories` - Category list page
- `/categories/add` - Add new category
- `/categories/edit/:id` - Edit existing category

**Note:** Routes are accessible regardless of authentication status (as configured in App.jsx).

---

## Dependencies

- **React** - UI framework
- **Redux Toolkit** - State management
- **React Router** - Routing
- **Moment.js** - Date formatting
- **Bootstrap** - UI components and styling

---

## Error Handling

### API Errors

- All API errors are caught and stored in Redux state
- Error messages are displayed in toast notifications
- Network errors are handled gracefully
- HTTP status codes are checked before processing responses

### Form Validation Errors

- Client-side validation before submission
- Real-time error feedback
- Field-specific error messages
- Prevents invalid data submission

---

## Best Practices

1. **Always use `.unwrap()`** when dispatching async thunks to handle errors properly
2. **Clean up timeouts** in `useEffect` cleanup functions
3. **Reset pagination** when changing search/sort/filter
4. **Show loading states** during async operations
5. **Handle edge cases** like empty lists, network errors, etc.
6. **Use debouncing** for search inputs to reduce API calls
7. **Clear Redux state** when navigating away from pages

---

## Future Enhancements

Potential improvements for the category module:

1. **Parent Categories** - Support for hierarchical category structure
2. **Bulk Operations** - Select multiple categories for bulk delete/update
3. **Category Images** - Upload and manage category images
4. **Export/Import** - CSV export and import functionality
5. **Advanced Filters** - Filter by status, date range, etc.
6. **Category Statistics** - Display product count per category
7. **Drag & Drop Sorting** - Reorder categories visually
8. **Category Templates** - Pre-defined category templates

---

## Troubleshooting

### CORS Issues

If encountering CORS errors, ensure:

- Backend CORS configuration allows requests from frontend origin
- Vite proxy is configured in `vite.config.js` (for development)
- API base URL is correctly set in `apiConfig.js`

### Authentication Issues

- Verify `authToken` is stored in `localStorage`
- Check token format: `Bearer {token}`
- Ensure token is included in request headers

### Pagination Issues

- Verify backend API returns correct pagination format
- Check `skip` calculation: `skip = (page - 1) * limit`
- Ensure `total` and `totalPages` are calculated correctly

### Search/Sort Not Working

- Verify API endpoints accept `search`, `sortBy`, and `sortOrder` parameters
- Check Redux state to ensure parameters are being set correctly
- Verify API response format matches expected structure

---

## Support

For issues or questions regarding the Category Module:

1. Check this documentation
2. Review the code comments in source files
3. Check Redux DevTools for state debugging
4. Review browser console for errors

---

**Last Updated:** 2024
**Version:** 1.0.0
