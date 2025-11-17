# Permission Management System

A smart, reusable permission management system for the AI POS application.

## Features

- ✅ Easy-to-use React hooks
- ✅ Type-safe permission checking
- ✅ Automatic route protection
- ✅ Conditional UI rendering
- ✅ Centralized permission logic

## Usage

### Basic Hook Usage

```javascript
import { usePermissions } from '../../hooks/usePermissions.js';

const MyComponent = () => {
  // Get permissions for a specific module
  const { canView, canEdit, canDelete } = usePermissions('category');

  return (
    <div>
      {canView && <div>Category List</div>}
      {canEdit && <button>Edit Category</button>}
      {canDelete && <button>Delete Category</button>}
    </div>
  );
};
```

### General Permissions Hook

```javascript
import { usePermissions } from '../../hooks/usePermissions.js';

const MyComponent = () => {
  // Get general permission utilities
  const permissions = usePermissions();

  // Check permissions for different modules
  const canEditCategory = permissions.canEdit('category');
  const canViewOrder = permissions.canView('order');
  const canDeleteIntegration = permissions.canDelete('integration');

  return <div>...</div>;
};
```

### Permission Object

```javascript
import { usePermissions } from '../../hooks/usePermissions.js';

const MyComponent = () => {
  const { modulePermissions } = usePermissions('category');

  // modulePermissions = { view: true, edit: true, delete: false }

  return <div>...</div>;
};
```

## Available Modules

Based on your user permissions structure:

- `category` - Category management
- `integration` - Integration management
- `order` - Order management
- `process` - Process management
- `proces` - Additional process module

## Permission Actions

Each module supports three actions:

- `view` - Can view/list items
- `edit` - Can create/update items
- `delete` - Can delete items

## Examples

### Route Protection

```javascript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';

const ProtectedPage = () => {
  const navigate = useNavigate();
  const { canView } = usePermissions('category');

  useEffect(() => {
    if (canView === false) {
      navigate('/dashboard');
    }
  }, [canView, navigate]);

  return <div>Protected Content</div>;
};
```

### Conditional Button Rendering

```javascript
const CategoryList = () => {
  const { canEdit, canDelete } = usePermissions('category');

  return (
    <div>
      {canEdit && <button onClick={handleAdd}>Add Category</button>}
      {items.map((item) => (
        <div key={item.id}>
          {canEdit && <button onClick={() => edit(item)}>Edit</button>}
          {canDelete && <button onClick={() => delete item}>Delete</button>}
        </div>
      ))}
    </div>
  );
};
```

### Multiple Module Checks

```javascript
const Dashboard = () => {
  const permissions = usePermissions();

  const hasCategoryAccess = permissions.canView('category');
  const hasOrderAccess = permissions.canView('order');
  const canEditIntegration = permissions.canEdit('integration');

  return (
    <div>
      {hasCategoryAccess && <CategoryWidget />}
      {hasOrderAccess && <OrderWidget />}
      {canEditIntegration && <IntegrationSettings />}
    </div>
  );
};
```

## Utility Functions

You can also use utility functions directly:

```javascript
import { canView, canEdit, canDelete, hasPermission } from '../../utils/permissions.js';
import { useSelector } from 'react-redux';

const MyComponent = () => {
  const state = useSelector((state) => state);

  const canEditCategory = canEdit(state, 'category');
  const canDeleteOrder = canDelete(state, 'order');
  const hasCustomPermission = hasPermission(state, 'integration', 'view');

  return <div>...</div>;
};
```

## Notes

- Permissions are automatically loaded from user data stored in Redux
- Permissions persist across page refreshes (stored in localStorage)
- All permission checks return `false` if user data is not available
- Use strict equality (`=== false`) when checking for permission denial to handle `undefined` cases
