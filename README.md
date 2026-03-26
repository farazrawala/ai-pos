# 🚀 AI POS - Point of Sale System

### 👋 Modern POS System built with React, Redux Toolkit & Vite

A full-featured Point of Sale (POS) system designed for managing products, categories, attributes, and inventory with a beautiful, modern UI powered by Argon Dashboard.

---

## ✨ About This Project

### 🎯 Features

- **Product Management** - Complete CRUD operations for products with variations
- **Category Management** - Hierarchical category system with parent-child relationships
- **Attribute Management** - Flexible attribute system for product customization
- **User Authentication** - Secure sign-in/sign-up with protected routes
- **Permission-Based Navigation** - Role-based access control
- **Real-time Loader** - Global loading state management
- **Modern UI** - Beautiful Argon Dashboard-inspired interface
- **Responsive Design** - Works seamlessly on all devices

### 🛠️ Tech Stack

- **Frontend Framework**: React 18
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **Build Tool**: Vite
- **HTTP Client**: Axios
- **UI Framework**: Argon Dashboard
- **Date Handling**: Moment.js

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+ (or Yarn 1.22+)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-pos.git

# Navigate to project directory
cd ai-pos

# Install dependencies
npm install
# or
yarn install
```

### Available Scripts

- `npm start` – Launch Vite dev server at http://localhost:5173
- `npm run build` – Bundle for production
- `npm run preview` – Preview production build locally
- `npm test` – Run tests (placeholder)
- `npm run lint` – Lint code (placeholder)

### Run Locally

```bash
npm start
# or
yarn start
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
# or
yarn build
```

---

## 📁 Project Structure

```
ai-pos/
├── src/
│   ├── api/
│   │   └── apiClient.js          # Axios instance + loader-aware interceptors
│   ├── components/
│   │   ├── Header.jsx             # Main header component
│   │   ├── Sidebar.jsx            # Navigation sidebar
│   │   ├── Footer.jsx             # Footer component
│   │   ├── Loader.jsx             # Global loader overlay
│   │   └── PostList.jsx           # Post list component
│   ├── config/
│   │   └── apiConfig.js           # API configuration
│   ├── features/
│   │   ├── attributes/            # Attribute management
│   │   ├── brands/                # Brand management
│   │   ├── categories/            # Category management
│   │   ├── products/              # Product management
│   │   ├── posts/                 # Posts feature
│   │   ├── loader/                # Loader state management
│   │   └── user/                  # User authentication
│   ├── hooks/
│   │   └── usePermissions.js      # Permission hook
│   ├── routes/
│   │   ├── attribute/             # Attribute routes
│   │   ├── category/              # Category routes
│   │   ├── product/               # Product routes
│   │   ├── Dashboard.jsx          # Dashboard page
│   │   ├── Home.jsx               # Home page
│   │   ├── SignIn.jsx             # Sign in page
│   │   └── SignUp.jsx             # Sign up page
│   ├── store/
│   │   └── index.js               # Redux store configuration
│   ├── utils/
│   │   └── permissions.js         # Permission utilities
│   ├── App.jsx                    # Main app component
│   └── index.js                   # Entry point
├── public/                        # Static assets
├── dist/                          # Build output
└── package.json                   # Dependencies
```

---

## 🔥 Key Features in Detail

### Product Management

- Create, read, update, and delete products
- Manage product variations
- Stock management
- Tree-based product organization

### Category Management

- Hierarchical category structure
- Parent-child category relationships
- Easy category navigation

### Attribute Management

- Flexible attribute system
- Custom attributes for products
- Attribute value management

### Authentication & Authorization

- Secure user authentication
- Protected routes
- Permission-based navigation
- User profile management

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/yourusername/ai-pos?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/ai-pos?style=social)
![GitHub issues](https://img.shields.io/github/issues/yourusername/ai-pos)
![GitHub license](https://img.shields.io/github/license/yourusername/ai-pos)

---

## 🛣️ Roadmap

- [ ] Complete product variation management
- [ ] Parent category implementation
- [ ] Purchase order system
- [ ] Stock management on edit
- [ ] Enhanced permission system
- [ ] Reporting and analytics
- [ ] Multi-warehouse support

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Author

**Your Name**

- GitHub: [@yourusername](https://github.com/yourusername)
- Website: [yourwebsite.com](https://yourwebsite.com)

---

## 🙏 Acknowledgments

- [Argon Dashboard](https://www.creative-tim.com/product/argon-dashboard) for the beautiful UI components
- [Vite](https://vitejs.dev/) for the amazing build tool
- [Redux Toolkit](https://redux-toolkit.js.org/) for state management
- All the amazing open-source contributors

---

## ⭐ Show your support

Give a ⭐️ if this project helped you!

---

**Made with ❤️ using React, Redux Toolkit & Vite**
