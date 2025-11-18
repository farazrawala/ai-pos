# Attribute Module Documentation

## Overview

The Attribute Module is a complete CRUD (Create, Read, Update, Delete) implementation for managing product attributes in the AI POS system. It includes server-side pagination, search, sorting, real-time toast notifications, and **attribute values management** with dynamic add/remove functionality.

## Table of Contents

1. [Architecture](#architecture)
2. [File Structure](#file-structure)
3. [API Endpoints](#api-endpoints)
4. [Redux State Management](#redux-state-management)
5. [Components](#components)
6. [Attribute Values Management](#attribute-values-management)
7. [Features](#features)
8. [Usage Examples](#usage-examples)
9. [Configuration](#configuration)

---

## Architecture

The Attribute Module follows a feature-based architecture pattern using Redux Toolkit for state management:

```
src/
├── features/
│   └── attributes/
│       ├── attributesAPI.js      # API service layer
│       └── attributesSlice.js    # Redux slice with async thunks
├── routes/
│   └── attribute/
│       ├── index.jsx             # List/Index page with attribute values display
│       ├── add.jsx               # Create page with attribute values management
│       └── edit.jsx              # Edit page with attribute values management
└── config/
    └── apiConfig.js              # Global API configuration
```

---

## File Structure

### 1. API Service Layer (`src/features/attributes/attributesAPI.js`)

Handles all HTTP requests to the backend API. Uses the global `API_BASE_URL` from `apiConfig.js`.

**Functions:**

- `fetchAttributesRequest(params)` - Fetch paginated list with search and sort
- `fetchAttributeByIdRequest(attributeId)` - Fetch single attribute by ID
- `createAttributeRequest(attributeData)` - Create new attribute with values
- `updateAttributeRequest(attributeId, attributeData)` - Update existing attribute with values
- `deleteAttributeRequest(attributeId)` - Delete attribute

**Authentication:**

- Automatically includes Bearer token from `localStorage.getItem('authToken')` in request headers

**Pagination:**

- Converts frontend `page` parameter to backend `skip` parameter
- Handles multiple response formats for backward compatibility

### 2. Redux Slice (`src/features/attributes/attributesSlice.js`)

Manages application state using Redux Toolkit.

**Async Thunks:**

- `fetchAttributes(params)` - Fetch attributes list
- `fetchAttributeById(attributeId)` - Fetch single attribute
- `createAttribute(attributeData)` - Create attribute with values
- `updateAttribute({ attributeId, attributeData })` - Update attribute with values
- `deleteAttribute(attributeId)` - Delete attribute

**State Structure:**

```javascript
{
  status: 'idle' | 'loading' | 'succeeded' | 'failed',
  list: [],                    // Array of attributes
  error: null,                 // Error message
  currentAttribute: null,      // Currently viewed/edited attribute
  fetchStatus: 'idle',         // Status for single attribute fetch
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
- `clearCurrentAttribute()` - Clear current attribute data

### 3. Components

#### Attribute List (`src/routes/attribute/index.jsx`)

**Features:**

- Server-side pagination (10, 25, 50, 100 items per page)
- Real-time search with 500ms debounce
- Sortable columns (click to sort, double-click to clear)
- **Attribute values display** as badges (shows first 3, then "+X more")
- Status toggle with real-time update
- Delete with confirmation dialog
- Toast notifications for success/error
- Responsive table layout
- Permission-based access control

**Sortable Columns:**

- Name
- Status
- Created At
- Last Updated At (updatedAt)

**Attribute Values Display:**

- Shows first 3 attribute values as badges
- Displays "+X more" badge if there are more than 3 values
- Badge format: info-colored badges with remove functionality in edit mode
- Empty state: "No values" message

**Date Display:**

- **Created At**: Displays in format `MM-DD-YYYY h:mm a` (e.g., "12-25-2024 3:45 PM")
- **Last Updated At**: Displays relative time using `moment().fromNow()` (e.g., "2 hours ago", "3 days ago")
- Both columns are sortable (click to sort, double-click to clear)

#### Attribute Add (`src/routes/attribute/add.jsx`)

**Features:**

- Form validation
- **Dynamic attribute values management** (add/remove values)
- Enter key support for quick value addition
- Real-time value preview as badges
- Success/error toast notifications
- Auto-redirect to list after successful creation
- Permission-based access control

**Form Fields:**

- **Name** (required) - Attribute name (e.g., "Color", "Size")
- **Attribute Values** (optional) - Array of value objects with `name` and `last_updated`

**Attribute Values Management:**

- Input field with "Add Value" button
- Press Enter or click button to add value
- Values displayed as removable badges
- Each value automatically includes `last_updated` timestamp
- Remove values by clicking the X button on badges

**Validation:**

- Name: Required, non-empty

#### Attribute Edit (`src/routes/attribute/edit.jsx`)

**Features:**

- Loads existing attribute data
- Pre-populated form fields
- **Existing attribute values display** and management
- **Add new values** functionality
- **Remove existing values** functionality
- Same validation as Add form
- Loading state while fetching data
- Error state if fetch fails
- Success/error toast notifications
- Auto-redirect to list after successful update
- Permission-based access control

**Attribute Values Management:**

- Display existing values as removable badges
- Add new values using input field
- Remove values by clicking X button
- Values maintain their `last_updated` timestamp

---

## API Endpoints

All endpoints use the base URL from `src/config/apiConfig.js` (default: `http://localhost:8000/api`).

### Get All Attributes (Paginated)

```
GET /attribute/get-all-active?skip=0&limit=10&search=term&sortBy=name&sortOrder=asc
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
  "data": [
    {
      "_id": "...",
      "name": "Color",
      "attribute_values": [
        {
          "name": "Red",
          "last_updated": "2024-12-25T10:30:00.000Z"
        },
        {
          "name": "Blue",
          "last_updated": "2024-12-25T10:31:00.000Z"
        }
      ],
      "status": "active",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": {
    "total": 50,
    "count": 10,
    "skip": 0,
    "limit": 10
  }
}
```

### Get Attribute by ID

```
GET /attribute/get/:attributeId
```

**Response:**

```json
{
  "data": {
    "_id": "...",
    "name": "Color",
    "attribute_values": [
      {
        "name": "Red",
        "last_updated": "2024-12-25T10:30:00.000Z"
      },
      {
        "name": "Blue",
        "last_updated": "2024-12-25T10:31:00.000Z"
      }
    ],
    "status": "active",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Create Attribute

```
POST /attribute/create
```

**Request Body:**

```json
{
  "name": "Color",
  "attribute_values": [
    {
      "name": "Red",
      "last_updated": "2024-12-25T10:30:00.000Z"
    },
    {
      "name": "Blue",
      "last_updated": "2024-12-25T10:31:00.000Z"
    }
  ]
}
```

**Note:** The `last_updated` field is automatically set by the frontend when adding values. The backend may also set this field.

### Update Attribute

```
PATCH /attribute/update/:attributeId
```

**Request Body:**

```json
{
  "name": "Updated Color",
  "attribute_values": [
    {
      "name": "Red",
      "last_updated": "2024-12-25T10:30:00.000Z"
    },
    {
      "name": "Green",
      "last_updated": "2024-12-25T11:00:00.000Z"
    }
  ],
  "status": "active"
}
```

**Note:** When updating, the entire `attribute_values` array is sent. New values will have a new `last_updated` timestamp, while existing values maintain their original timestamp (unless modified).

### Delete Attribute

```
DELETE /attribute/delete/:attributeId
```

---

## Redux State Management

### Dispatching Actions

**Fetch Attributes:**

```javascript
import { useDispatch } from 'react-redux';
import { fetchAttributes } from '../features/attributes/attributesSlice';

const dispatch = useDispatch();
dispatch(fetchAttributes({ page: 1, limit: 10, search: 'term', sortBy: 'name' }));
```

**Create Attribute with Values:**

```javascript
import { createAttribute } from '../features/attributes/attributesSlice';

const attributeData = {
  name: 'Color',
  attribute_values: [
    {
      name: 'Red',
      last_updated: new Date().toISOString(),
    },
    {
      name: 'Blue',
      last_updated: new Date().toISOString(),
    },
  ],
};

dispatch(createAttribute(attributeData))
  .unwrap()
  .then(() => {
    // Success
  })
  .catch((error) => {
    // Error handling
  });
```

**Update Attribute with Values:**

```javascript
import { updateAttribute } from '../features/attributes/attributesSlice';

dispatch(
  updateAttribute({
    attributeId: '123',
    attributeData: {
      name: 'Updated Color',
      attribute_values: [
        {
          name: 'Red',
          last_updated: '2024-12-25T10:30:00.000Z',
        },
        {
          name: 'Green',
          last_updated: new Date().toISOString(), // New value
        },
      ],
    },
  })
)
  .unwrap()
  .then(() => {
    // Success
  });
```

**Delete Attribute:**

```javascript
import { deleteAttribute } from '../features/attributes/attributesSlice';

dispatch(deleteAttribute('123'))
  .unwrap()
  .then(() => {
    // Success
  });
```

### Accessing State

```javascript
import { useSelector } from 'react-redux';

const {
  list, // Array of attributes
  status, // 'idle' | 'loading' | 'succeeded' | 'failed'
  error, // Error message
  pagination, // { page, limit, total, totalPages }
  search, // Current search term
  sort, // { sortBy, sortOrder }
  deleteStatus, // Delete operation status
  updateStatus, // Update operation status
  currentAttribute, // Currently viewed attribute
  fetchStatus, // Single attribute fetch status
} = useSelector((state) => state.attributes);
```

---

## Attribute Values Management

### Adding Values

**In Add/Edit Forms:**

```javascript
const handleAddValue = () => {
  if (newValue.trim()) {
    setForm((prev) => ({
      ...prev,
      attribute_values: [
        ...prev.attribute_values,
        {
          name: newValue.trim(),
          last_updated: new Date().toISOString(),
        },
      ],
    }));
    setNewValue('');
  }
};
```

**Features:**

- Input validation (non-empty)
- Automatic timestamp generation
- Enter key support for quick addition
- Real-time preview as badges

### Removing Values

**In Add/Edit Forms:**

```javascript
const handleRemoveValue = (index) => {
  setForm((prev) => ({
    ...prev,
    attribute_values: prev.attribute_values.filter((_, i) => i !== index),
  }));
};
```

**Features:**

- Click X button on badge to remove
- Immediate UI update
- No confirmation required (can be added if needed)

### Displaying Values

**In List View:**

```javascript
const attributeValues = item.attribute_values || [];

{
  attributeValues.length > 0 ? (
    <div className="d-flex flex-wrap gap-1">
      {attributeValues.slice(0, 3).map((value, idx) => (
        <span key={idx} className="badge bg-info text-dark">
          {value.name || value}
        </span>
      ))}
      {attributeValues.length > 3 && (
        <span className="badge bg-secondary">+{attributeValues.length - 3} more</span>
      )}
    </div>
  ) : (
    <span className="text-muted">No values</span>
  );
}
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

### 4. Attribute Values Management

- Dynamic add/remove values
- Enter key support for quick addition
- Badge display with remove functionality
- Automatic timestamp generation
- Real-time preview

### 5. Toast Notifications

- Success toasts for create/update/delete
- Error toasts with specific error messages
- Bootstrap Toast API with fallback
- Auto-dismiss after 5 seconds
- Timestamp display

### 6. Form Validation

- Client-side validation
- Real-time error feedback
- Required field indicators
- Prevents invalid data submission

### 7. Permission-Based Access Control

- View permission check
- Create permission check
- Edit permission check
- Delete permission check
- Automatic redirect if permission denied

### 8. Status Toggle

- Real-time status update
- Loading state during toggle
- Error handling with toast notifications
- Visual feedback with badges

---

## Usage Examples

### Basic List View

```javascript
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAttributes } from '../features/attributes/attributesSlice';

const AttributeList = () => {
  const dispatch = useDispatch();
  const { list, status, pagination } = useSelector((state) => state.attributes);

  useEffect(() => {
    dispatch(
      fetchAttributes({
        page: pagination.page,
        limit: pagination.limit,
      })
    );
  }, [dispatch, pagination.page, pagination.limit]);

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'failed') return <div>Error loading attributes</div>;

  return (
    <div>
      {list.map((attribute) => (
        <div key={attribute._id}>
          <div>{attribute.name}</div>
          <div>
            {attribute.attribute_values?.map((value, idx) => (
              <span key={idx}>{value.name}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Create Attribute with Values

```javascript
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { createAttribute } from '../features/attributes/attributesSlice';

const AttributeForm = () => {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [values, setValues] = useState([]);
  const [newValue, setNewValue] = useState('');

  const handleAddValue = () => {
    if (newValue.trim()) {
      setValues([
        ...values,
        {
          name: newValue.trim(),
          last_updated: new Date().toISOString(),
        },
      ]);
      setNewValue('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(
        createAttribute({
          name,
          attribute_values: values,
        })
      ).unwrap();
      // Success
    } catch (error) {
      // Error handling
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Attribute name"
        required
      />
      <div>
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Add value"
        />
        <button type="button" onClick={handleAddValue}>
          Add
        </button>
      </div>
      <div>
        {values.map((value, idx) => (
          <span key={idx}>
            {value.name}
            <button type="button" onClick={() => setValues(values.filter((_, i) => i !== idx))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <button type="submit">Create Attribute</button>
    </form>
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

Default pagination settings are in `attributesSlice.js`:

```javascript
pagination: {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0
}
```

### Search Debounce

Search debounce delay is set in `src/routes/attribute/index.jsx`:

```javascript
setTimeout(() => {
  dispatch(setSearch(value));
}, 500); // 500ms debounce
```

---

## Routes

The attribute routes are configured in `src/App.jsx`:

- `/attributes` - Attribute list page
- `/attributes/add` - Add new attribute
- `/attributes/edit/:id` - Edit existing attribute

**Note:** Routes include permission checks and redirect if user doesn't have access.

## Navigation

The attribute module navigation is configured in `src/components/Sidebar.jsx`:

### Sidebar Navigation

The Attributes link is added to the sidebar under the "MANAGEMENT" section:

```jsx
<li className="nav-item">
  <NavLink className="nav-link" to="/attributes">
    <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
      <i className="ni ni-tag text-dark text-sm opacity-10"></i>
    </div>
    <span className="nav-link-text ms-1">Attributes</span>
  </NavLink>
</li>
```

**Navigation Structure:**

- **MANAGEMENT Section**
  - **Categories** - Links to `/categories`
  - **Products** - Links to `/products`
  - **Attributes** - Links to `/attributes`

**Features:**

- Active route highlighting (handled by `NavLink` component)
- Icon display using Font Awesome icons
- Responsive sidebar navigation
- Permission-based visibility (can be extended to hide navigation items based on permissions)

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
8. **Validate attribute values** before adding to prevent duplicates (can be enhanced)
9. **Handle empty attribute values** gracefully in display

---

## Future Enhancements

Potential improvements for the attribute module:

1. **Duplicate Value Prevention** - Prevent adding duplicate attribute values
2. **Bulk Operations** - Select multiple attributes for bulk delete/update
3. **Value Sorting** - Sort attribute values alphabetically or by date
4. **Value Search** - Search within attribute values
5. **Import/Export** - CSV import and export functionality
6. **Attribute Templates** - Pre-defined attribute templates
7. **Value Validation** - Custom validation rules for attribute values
8. **Value Categories** - Group attribute values into categories
9. **Attribute Relationships** - Link attributes to products/categories
10. **Advanced Filters** - Filter by status, date range, value count, etc.

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

### Attribute Values Not Displaying

- Check that `attribute_values` is an array in the API response
- Verify value objects have a `name` property
- Check browser console for errors
- Ensure values are properly mapped in the component

---

## Support

For issues or questions regarding the Attribute Module:

1. Check this documentation
2. Review the code comments in source files
3. Check Redux DevTools for state debugging
4. Review browser console for errors
5. Check network tab for API request/response details

---

**Last Updated:** 2024
**Version:** 1.0.0
