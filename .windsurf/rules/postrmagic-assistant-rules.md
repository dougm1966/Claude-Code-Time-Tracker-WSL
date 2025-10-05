---
trigger: always_on
---

# Global Rules for Development with Next.js, TailAdmin, TypeScript, and Supabase

## General Development Rules
- Search for existing components, hooks, or utilities in the codebase. If found, modify them to meet the task requirements. Do not create new code if existing code can be reused.
- Modify only the files and code sections directly related to the task. Do not edit unrelated files or functionality.
- Organize files in directories: pages/, components/, hooks/, lib/, styles/. Name components in PascalCase (e.g., MyComponent). Name variables in camelCase (e.g., myVariable).
- If a file exceeds 300 lines of code, split it into smaller files. Move reusable logic to components, hooks, or utilities.
- Write unit tests and integration tests using Jest and React Testing Library. Test Next.js API routes, Supabase queries, and UI components. Ensure 80% test coverage for new code.
- Do not refactor established patterns or architecture unless the task explicitly requires it. If the feature is functional, maintain its current structure.

## Server and Environment Rules
- After code changes, run `npm run dev` to restart the Next.js development server. Verify changes in the browser.
- Before starting a new Next.js server, terminate all existing server processes. Use `ps aux | grep node` and `kill -9 <pid>` on Unix systems to stop them.
- Use environment variables for different environments: `development`, `test`, `production`. Define variables in `.env.local` for development, `.env.test` for testing, and `.env.production` for production. Access Supabase URL as `process.env.NEXT_PUBLIC_SUPABASE_URL`.
- Do not modify `.env` files unless the task includes a specific instruction to do so. If modification is required, confirm the exact changes with the user.
- Store Supabase credentials in environment variables: `NEXT_PUBLIC_SUPABASE_URL` for client-side, `SUPABASE_SERVICE_ROLE_KEY` for server-side. Do not include these credentials in source code.

## Code Quality Rules
- Identify the simplest solution for the task. Use existing Next.js, TailAdmin, or Supabase features if they solve the problem. Do not introduce new libraries or patterns unless necessary.
- Define TypeScript types for all data structures. For Supabase queries, define types for responses. Example: `type User = { id: string; email: string; name: string; }; const { data } = await supabase.from<User>('users').select('*');`.
- Do not create separate script files for one-time tasks. Implement one-time logic in Next.js API routes or utility functions.
- Do not add fake data or stubs in `development` or `production` environments. For `test` environments, use Supabase seeding scripts to populate test data.
- In tests, mock Supabase queries using the `msw` library. Do not use mocks outside the `test` environment.

## Next.js Rules
- Use Server-Side Rendering (SSR) with `getServerSideProps` or Static Site Generation (SSG) with `getStaticProps` for data fetching. Fetch Supabase data in these functions.
- Use `next/image` for all image elements. Enable dynamic imports for large components: `const MyComponent = dynamic(() => import('../components/MyComponent'));`.
- Secure Next.js API routes with Supabase authentication. Verify user tokens: `const { user } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1] || ''); if (!user) return res.status(401).json({ error: 'Unauthorized' });`.
- Place pages in the `pages/` directory. Use dynamic routes for dynamic content: `pages/users/[id].tsx` for user-specific pages.

## TailAdmin and Styling Rules
- Use TailAdmin components (e.g., cards, tables) for UI elements. Apply Tailwind CSS classes to customize styles.
- Add Tailwind CSS classes directly in JSX/TSX elements. Do not use inline CSS or separate CSS files unless required for animations.
- Ensure UI elements are responsive. Use Tailwind utilities: `md:` for medium screens, `lg:` for large screens.
- Do not override TailAdmin styles unless the task requires branding changes. If overridden, add a comment explaining the change.

## Supabase Rules
- Enable Row-Level Security (RLS) on Supabase tables. Restrict access based on user roles. Use `SERVICE_ROLE_KEY` only in server-side code.
- Fetch only required columns with `select()`. For large datasets, paginate with `range()`: `const { data } = await supabase.from('posts').select('id, title').range(0, 9);`.
- Check for Supabase errors: `const { data, error } = await supabase.from('users').select('*'); if (error) throw new Error(error.message);`.
- Use Supabase Auth for user authentication. Integrate with Next.js middleware to secure routes.
- Use Supabase seeding for test data. Run seeding scripts only in the `test` environment.

## Debugging Rules
- Fix bugs using the current implementation. Do not introduce new patterns unless all existing options fail.
- If a new pattern is introduced, delete the old implementation. Update tests to match the new pattern.
- Evaluate the impact of changes on Next.js API routes, Supabase queries, and UI components. Document any potential side effects.

## Performance Rules
- Use `@next/bundle-analyzer` to check bundle size. If bundle size exceeds 500 KB, optimize by removing unused code or using dynamic imports.
- Index Supabase tables for frequently queried columns. Fetch only required data to reduce query load.
- Use Next.js middleware for authentication, redirects, and URL rewriting to improve performance.

## Documentation Rules
- Add comments to explain complex logic in Supabase queries, Next.js API routes, and custom components.
- Document how code changes affect other areas, such as data fetching, UI rendering, or database performance.