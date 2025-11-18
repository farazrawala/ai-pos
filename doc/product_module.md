# Product Module Documentation

## Overview

The Product Module is a complete CRUD (Create, Read, Update, Delete) implementation for managing products in the AI POS system. It includes server-side pagination, search, sorting, real-time toast notifications, and **comprehensive image upload support** with both single and bulk image uploads.

## Table of Contents

1. [Architecture](#architecture)
2. [File Structure](#file-structure)
3. [API Endpoints](#api-endpoints)
4. [Redux State Management](#redux-state-management)
5. [Components](#components)
6. [Image Upload Features](#image-upload-features)
7. [Features](#features)
8. [Usage Examples](#usage-examples)
9. [Configuration](#configuration)

---

## Architecture

The Product Module follows a feature-based architecture pattern using Redux Toolkit for state management:

```
src/
├── features/
│   └── products/
│       ├── productsAPI.js      # API service layer with image upload
│       └── productsSlice.js    # Redux slice with async thunks
├── routes/
│   └── product/
│       ├── index.jsx          # List/Index page with image display
│       ├── add.jsx             # Create page with image upload
│       └── edit.jsx             # Edit page with image management
└── config/
    └── apiConfig.js            # Global API configuration
```

---

## File Structure

### 1. API Service Layer (`src/features/products/productsAPI.js`)

Handles all HTTP requests to the backend API, including image uploads. Uses the global `API_BASE_URL` from `apiConfig.js`.

**Functions:**

- `fetchProductsRequest(params)` - Fetch paginated list with search and sort
- `fetchProductByIdRequest(productId)` - Fetch single product by ID
- `createProductRequest(productData, images)` - Create new product with images
- `updateProductRequest(productId, productData, images)` - Update existing product with images
- `deleteProductRequest(productId)` - Delete product
- `uploadProductImageRequest(productId, imageFile)` - Upload single image
- `uploadBulkProductImagesRequest(productId, imageFiles)` - Upload multiple images

**Image Upload:**

- Automatically uses `FormData` when images are provided
- Falls back to JSON when no images are included
- Supports both File objects and URL strings
- Handles single image and bulk image uploads

**Authentication:**

- Automatically includes Bearer token from `localStorage.getItem('authToken')` in request headers

**Pagination:**

- Converts frontend `page` parameter to backend `skip` parameter
- Handles multiple response formats for backward compatibility

### 2. Redux Slice (`src/features/products/productsSlice.js`)

Manages application state using Redux Toolkit.

**Async Thunks:**

- `fetchProducts(params)` - Fetch products list
- `fetchProductById(productId)` - Fetch single product
- `createProduct({ productData, images })` - Create product with images
- `updateProduct({ productId, productData, images })` - Update product with images
- `deleteProduct(productId)` - Delete product
- `uploadProductImage({ productId, imageFile })` - Upload single image
- `uploadBulkProductImages({ productId, imageFiles })` - Upload multiple images

**State Structure:**

```javascript
{
  status: 'idle' | 'loading' | 'succeeded' | 'failed',
  list: [],                    // Array of products
  error: null,                 // Error message
  currentProduct: null,        // Currently viewed/edited product
  fetchStatus: 'idle',         // Status for single product fetch
  fetchError: null,
  updateStatus: 'idle',        // Status for update operation
  updateError: null,
  deleteStatus: 'idle',        // Status for delete operation
  deleteError: null,
  uploadImageStatus: 'idle',    // Status for image upload
  uploadImageError: null,
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
- `clearCurrentProduct()` - Clear current product data
- `clearUploadImageStatus()` - Clear image upload status

### 3. Components

#### Product List (`src/routes/product/index.jsx`)

**Features:**

- Server-side pagination (10, 25, 50, 100 items per page)
- Real-time search with 500ms debounce
- Sortable columns (click to sort, double-click to clear)
- Product image display (first image or placeholder)
- Status toggle with real-time update
- Delete with confirmation dialog
- Toast notifications for success/error
- Responsive table layout
- Permission-based access control

**Sortable Columns:**

- Name
- Price
- Stock
- Status (isActive)
- Created At
- Last Updated At (updatedAt)

**Image Display:**

- Shows first product image or placeholder icon
- Fallback to default image on error
- Thumbnail size: 50x50px

**Date Display:**

- **Created At**: Displays in format `MM-DD-YYYY h:mm a` (e.g., "12-25-2024 3:45 PM")
- **Last Updated At**: Displays relative time using `moment().fromNow()` (e.g., "2 hours ago", "3 days ago")
- Both columns are sortable (click to sort, double-click to clear)

#### Product Add (`src/routes/product/add.jsx`)

**Features:**

- Form validation
- Auto-generated slug from name
- Manual slug editing
- Category selection dropdown
- **Single image upload** with preview
- **Bulk images upload** (up to 10 images) with previews
- Image validation (file type, size limits)
- Success/error toast notifications
- Auto-redirect to list after successful creation

**Form Fields:**

- **Name** (required) - Product name
- **Slug** (required) - URL-friendly identifier (auto-generated)
- **Category** (required) - Product category selection
- **Price** (required) - Product price (decimal)
- **Stock** (optional) - Stock quantity
- **SKU** (optional) - Stock Keeping Unit
- **Description** (optional) - Product description

**Image Upload:**

- **Single Image**: Main product image (max 5MB)
- **Bulk Images**: Additional product images (max 10 images, 5MB each)
- Real-time preview before upload
- Remove image functionality
- File type validation (images only)
- File size validation

#### Product Edit (`src/routes/product/edit.jsx`)

**Features:**

- Loads existing product data
- Pre-populated form fields
- **Existing image display** and management
- **Replace single image** functionality
- **Add/remove bulk images** functionality
- Same validation as Add form
- Loading state while fetching data
- Error state if fetch fails
- Success/error toast notifications
- Auto-redirect to list after successful update

**Image Management:**

- Display existing images
- Replace main image with new upload
- Add additional images to existing ones
- Remove existing images
- Preview new images before saving

---

## API Endpoints

All endpoints use the base URL from `src/config/apiConfig.js` (default: `http://localhost:8000/api`).

### Get All Products (Paginated)

```
GET /product/get-all-active?skip=0&limit=10&search=term&sortBy=name&sortOrder=asc&categoryId=123
```

**Query Parameters:**

- `skip` - Number of records to skip (calculated from page)
- `limit` - Number of records per page
- `search` - Search term (optional)
- `sortBy` - Field name to sort by (optional)
- `sortOrder` - 'asc' or 'desc' (optional)
- `categoryId` - Filter by category (optional)

**Response Format:**

The API returns products with field names `product_name` and `product_price`. The frontend automatically handles these field names and can also work with `name` and `price` for backward compatibility:

```json
{
  "data": [
    {
      "_id": "...",
      "product_name": "Product Name",
      "slug": "product-slug",
      "product_price": 99.99,
      "stock": 50,
      "images": ["url1", "url2"],
      "categoryId": "...",
      "isActive": true,
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

**Field Name Handling:**

The frontend automatically handles API field names:

- **API Response**: `product_name`, `product_price`
- **Frontend Display**: Works with both `product_name`/`name` and `product_price`/`price`
- **API Request**: Frontend maps `name` → `product_name` and `price` → `product_price` when sending data
- **Product ID**: `_id` or `id` or `product_id` - Product identifier

This ensures compatibility with the API's expected field names while maintaining a clean frontend interface.

### Get Product by ID

```
GET /product/get/:productId
```

**Response:**

```json
{
  "data": {
    "_id": "...",
    "product_name": "Product Name",
    "slug": "product-slug",
    "description": "...",
    "product_price": 99.99,
    "stock": 50,
    "sku": "SKU123",
    "images": ["url1", "url2"],
    "categoryId": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Note:** The API returns `product_name` and `product_price`. The frontend automatically handles these field names and can also work with `name` and `price` for display purposes.

### Create Product

```
POST /product/create
```

**Request (with images - FormData):**

The frontend automatically maps field names before sending to the API:

- `name` → `product_name`
- `price` → `product_price`

```
Content-Type: multipart/form-data

FormData:
- product_name: "Product Name"      (mapped from "name")
- slug: "product-slug"
- description: "..."
- product_price: 99.99              (mapped from "price")
- stock: 50
- sku: "SKU123"
- categoryId: "..."
- images: [File, File, ...]
```

**Request (without images - JSON):**

```json
{
  "product_name": "Product Name", // mapped from "name"
  "slug": "product-slug",
  "description": "...",
  "product_price": 99.99, // mapped from "price"
  "stock": 50,
  "sku": "SKU123",
  "categoryId": "..."
}
```

**Note:** The frontend uses `name` and `price` internally, but automatically maps them to `product_name` and `product_price` when sending requests to the API.

### Update Product

```
PATCH /product/update/:productId
```

**Request (with images - FormData):**

The frontend automatically maps field names before sending to the API:

- `name` → `product_name`
- `price` → `product_price`

```
Content-Type: multipart/form-data

FormData:
- product_name: "Updated Name"      (mapped from "name")
- product_price: 89.99              (mapped from "price")
- images: [File, File, ...]
```

**Request (without images - JSON):**

```json
{
  "product_name": "Updated Name", // mapped from "name"
  "product_price": 89.99 // mapped from "price"
}
```

**Note:** The frontend uses `name` and `price` internally, but automatically maps them to `product_name` and `product_price` when sending requests to the API.

### Delete Product

```
DELETE /product/delete/:productId
```

### Upload Single Image

```
POST /product/upload-image/:productId
```

**Request:**

```
Content-Type: multipart/form-data

FormData:
- image: File
```

### Upload Bulk Images

```
POST /product/upload-images/:productId
```

**Request:**

```
Content-Type: multipart/form-data

FormData:
- images: [File, File, ...]
```

---

## Redux State Management

### Dispatching Actions

**Fetch Products:**

```javascript
import { useDispatch } from 'react-redux';
import { fetchProducts } from '../features/products/productsSlice';

const dispatch = useDispatch();
dispatch(fetchProducts({ page: 1, limit: 10, search: 'term', sortBy: 'name' }));
```

**Create Product with Images:**

```javascript
import { createProduct } from '../features/products/productsSlice';

// Frontend uses 'name' and 'price' internally
const productData = {
  name: 'New Product', // Will be mapped to 'product_name' in API
  slug: 'new-product',
  price: 99.99, // Will be mapped to 'product_price' in API
  categoryId: '123',
};

const images = [file1, file2]; // File objects

dispatch(createProduct({ productData, images }))
  .unwrap()
  .then(() => {
    // Success
  })
  .catch((error) => {
    // Error handling
  });
```

**Note:** The frontend uses `name` and `price` internally, but the API layer automatically maps them to `product_name` and `product_price` before sending to the backend.

**Update Product with Images:**

```javascript
import { updateProduct } from '../features/products/productsSlice';

// Frontend uses 'name' and 'price' internally
dispatch(
  updateProduct({
    productId: '123',
    productData: {
      name: 'Updated Name', // Will be mapped to 'product_name' in API
      price: 89.99, // Will be mapped to 'product_price' in API
    },
    images: [newFile], // Optional: new images to add
  })
)
  .unwrap()
  .then(() => {
    // Success
  });
```

**Note:** The frontend uses `name` and `price` internally, but the API layer automatically maps them to `product_name` and `product_price` before sending to the backend.

**Delete Product:**

```javascript
import { deleteProduct } from '../features/products/productsSlice';

dispatch(deleteProduct('123'))
  .unwrap()
  .then(() => {
    // Success
  });
```

### Accessing State

```javascript
import { useSelector } from 'react-redux';

const {
  list, // Array of products
  status, // 'idle' | 'loading' | 'succeeded' | 'failed'
  error, // Error message
  pagination, // { page, limit, total, totalPages }
  search, // Current search term
  sort, // { sortBy, sortOrder }
  deleteStatus, // Delete operation status
  updateStatus, // Update operation status
  uploadImageStatus, // Image upload status
  currentProduct, // Currently viewed product
  fetchStatus, // Single product fetch status
} = useSelector((state) => state.products);
```

---

## Image Upload Features

### Single Image Upload

**Purpose:** Upload a main product image

**Features:**

- File input with image type restriction
- File size validation (max 5MB)
- Real-time preview before upload
- Remove image functionality
- Preview display (200x200px thumbnail)

**Implementation:**

```javascript
const handleSingleImageChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ singleImage: 'Image size must be less than 5MB' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrors({ singleImage: 'Please select a valid image file' });
      return;
    }

    setSingleImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setSingleImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  }
};
```

### Bulk Images Upload

**Purpose:** Upload multiple additional product images

**Features:**

- Multiple file selection (up to 10 images)
- Individual file validation
- Batch preview display
- Remove individual images
- Grid layout for previews (4 columns)

**Implementation:**

```javascript
const handleBulkImagesChange = (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 10) {
    setErrors({ bulkImages: 'Maximum 10 images allowed' });
    return;
  }

  const validFiles = files.filter((file) => {
    if (file.size > 5 * 1024 * 1024) return false;
    if (!file.type.startsWith('image/')) return false;
    return true;
  });

  setBulkImages(validFiles);

  // Create previews
  validFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setBulkImagePreviews((prev) => [...prev, reader.result]);
    };
    reader.readAsDataURL(file);
  });
};
```

### Image Upload in API

**FormData Construction:**

```javascript
const formData = new FormData();

// Add product data
Object.keys(productData).forEach((key) => {
  if (productData[key] !== undefined && productData[key] !== null) {
    formData.append(key, productData[key]);
  }
});

// Add images
images.forEach((image) => {
  if (image instanceof File) {
    formData.append('images', image);
  } else if (typeof image === 'string') {
    formData.append('imageUrls[]', image);
  }
});
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

### 4. Image Management

- Single main image upload
- Multiple additional images
- Image preview before upload
- Remove images functionality
- Existing image display in edit mode
- Image validation (type and size)

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
- Slug format validation
- Price and stock number validation
- Image file validation

### 7. Auto-Generated Slugs

- Automatic slug generation from product name
- Manual override capability
- Slug format: lowercase, alphanumeric, hyphens only
- Auto-updates when name changes (if slug was auto-generated)

### 8. Permission-Based Access Control

- View permission check
- Create permission check
- Edit permission check
- Delete permission check
- Automatic redirect if permission denied

---

## Usage Examples

### Basic List View with Images

```javascript
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../features/products/productsSlice';

const ProductList = () => {
  const dispatch = useDispatch();
  const { list, status, pagination } = useSelector((state) => state.products);

  useEffect(() => {
    dispatch(
      fetchProducts({
        page: pagination.page,
        limit: pagination.limit,
      })
    );
  }, [dispatch, pagination.page, pagination.limit]);

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'failed') return <div>Error loading products</div>;

  return (
    <div>
      {list.map((product) => (
        <div key={product._id}>
          {product.images && product.images.length > 0 && (
            <img src={product.images[0]} alt={product.product_name || product.name} />
          )}
          <div>{product.product_name || product.name}</div>
          <div>${product.product_price || product.price}</div>
        </div>
      ))}
    </div>
  );
};
```

### Create Product with Images

```javascript
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { createProduct } from '../features/products/productsSlice';

const ProductForm = () => {
  const dispatch = useDispatch();
  const [singleImage, setSingleImage] = useState(null);
  const [bulkImages, setBulkImages] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend uses 'name' and 'price' - API layer maps to 'product_name' and 'product_price'
    const productData = {
      name: 'New Product', // Maps to 'product_name' in API
      slug: 'new-product',
      price: 99.99, // Maps to 'product_price' in API
      categoryId: '123',
    };

    const images = [];
    if (singleImage) images.push(singleImage);
    if (bulkImages.length > 0) images.push(...bulkImages);

    try {
      await dispatch(createProduct({ productData, images })).unwrap();
      // Success
    } catch (error) {
      // Error handling
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" accept="image/*" onChange={(e) => setSingleImage(e.target.files[0])} />
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setBulkImages(Array.from(e.target.files))}
      />
      <button type="submit">Create Product</button>
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

### Image Upload Limits

Image upload limits are configured in the component files:

- **Single Image**: Max 5MB
- **Bulk Images**: Max 10 images, 5MB each
- **File Types**: Images only (`image/*`)

To change these limits, update the validation in:

- `src/routes/product/add.jsx`
- `src/routes/product/edit.jsx`

### Default Pagination

Default pagination settings are in `productsSlice.js`:

```javascript
pagination: {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0
}
```

### Search Debounce

Search debounce delay is set in `src/routes/product/index.jsx`:

```javascript
setTimeout(() => {
  dispatch(setSearch(value));
}, 500); // 500ms debounce
```

---

## Routes

The product routes are configured in `src/App.jsx`:

- `/products` - Product list page
- `/products/add` - Add new product
- `/products/edit/:id` - Edit existing product

**Note:** Routes include permission checks and redirect if user doesn't have access.

## Navigation

The product module navigation is configured in `src/components/Sidebar.jsx`:

### Sidebar Navigation

The Products link is added to the sidebar under the "MANAGEMENT" section:

```jsx
<li className="nav-item">
  <NavLink className="nav-link" to="/products">
    <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
      <i className="ni ni-box-2 text-dark text-sm opacity-10"></i>
    </div>
    <span className="nav-link-text ms-1">Products</span>
  </NavLink>
</li>
```

**Navigation Structure:**

- **MANAGEMENT Section**
  - **Categories** - Links to `/categories`
  - **Products** - Links to `/products`

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

### Image Upload Errors

- File size validation
- File type validation
- Error messages for invalid files
- Graceful handling of upload failures

---

## Best Practices

1. **Always use `.unwrap()`** when dispatching async thunks to handle errors properly
2. **Clean up timeouts** in `useEffect` cleanup functions
3. **Reset pagination** when changing search/sort/filter
4. **Show loading states** during async operations
5. **Handle edge cases** like empty lists, network errors, etc.
6. **Use debouncing** for search inputs to reduce API calls
7. **Clear Redux state** when navigating away from pages
8. **Validate images** before upload to prevent server errors
9. **Show previews** before upload for better UX
10. **Handle image errors** with fallback placeholders

---

## Future Enhancements

Potential improvements for the product module:

1. **Image Cropping** - Crop images before upload
2. **Image Compression** - Compress images client-side before upload
3. **Drag & Drop Upload** - Drag and drop interface for images
4. **Image Gallery** - Full-screen image gallery view
5. **Bulk Import** - CSV import with image URLs
6. **Product Variants** - Support for product variants (size, color, etc.)
7. **Inventory Management** - Advanced stock management features
8. **Product Reviews** - Customer review system
9. **Product Tags** - Tag system for better organization
10. **Advanced Filters** - Filter by price range, stock status, etc.

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

### Image Upload Issues

- Verify file size is within limits (5MB per image)
- Check file type is a valid image format
- Ensure backend accepts `multipart/form-data`
- Check network tab for upload progress
- Verify backend image upload endpoint is working

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

For issues or questions regarding the Product Module:

1. Check this documentation
2. Review the code comments in source files
3. Check Redux DevTools for state debugging
4. Review browser console for errors
5. Check network tab for API request/response details

---

**Last Updated:** 2024
**Version:** 1.0.0
