# Coding Standards and Best Practices

Coding style guidelines for the frontend team

## Table of Contents

1. [Introduction](#overview)
2. [Variables](#variables)
3. [Functions](#functions)
4. [Architecture](#architecture) — includes Separation of Concerns, **DRY**, and SOLID
5. [Security](#security)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [PR Hygiene and Code Quality](#pr-hygiene)
9. [Team Agreements and Decisions](#agreements)

## Overview

Our guidelines, principles, and standards help us:

- Maintain high-quality code consistently across all projects.
- Allow several developers to work on the same codebase simultaneously in a unified manner.
- Produce code that's more reliable and easier to understand, debug, and maintain.
- Support the creation of reusable code.

## Contributing

We prioritize **consistent coding practices** over **individual coding styles**. This document will be updated regularly
to keep up with the needs of our development team and the nature of our projects.

## **Variables**

### Use meaningful and pronounceable variable names

**Bad:**

```javascript
const d = new Date();
```

**Good:**

```javascript
const currentDate = new Date();
```

### Avoid using magic numbers or magic strings

**Bad:**

```javascript
// What is 86400000 for?
setTimeout(someFunction, 86400000);
```

**Good:**

```javascript
// Declare them as capitalized named constants.
const MILLISECONDS_PER_DAY = 60 * 60 * 24 * 1000; //86400000;

setTimeout(someFunction, MILLISECONDS_PER_DAY);
```

### Use explanatory variables

**Bad:**

```javascript
const address = "city, country 95014";
const cityZipCodeRegex = /^[^,\\]+[,\\\s]+(.+?)\s*(\d{5})?$/;
saveCityZipCode(
  address.match(cityZipCodeRegex)[1],
  address.match(cityZipCodeRegex)[2]
);
```

**Good:**

```javascript
const address = "city, country 95014";
const cityZipCodeRegex = /^[^,\\]+[,\\\s]+(.+?)\s*(\d{5})?$/;
const [_, city, zipCode] = address.match(cityZipCodeRegex) || [];
saveCityZipCode(city, zipCode);
```

### Avoid Mental Mapping

**Bad:**

```javascript
const locations = ["Austin", "New York", "San Francisco"];
locations.forEach((l) => {
  doStuff();
  doSomeOtherStuff();
  // Wait, what is `l` for again?
  dispatch(l);
});
```

**Good:**

```javascript
const locations = ["Austin", "New York", "San Francisco"];
locations.forEach((location) => {
  doStuff();
  doSomeOtherStuff();
  dispatch(location);
});
```

### Don't add unneeded context

If your class/object name tells you something, don't repeat that in your
variable name.

**Bad:**

```javascript
const Car = {
  carMake: "Mercedes",
  carModel: "GLC",
  carColor: "Sliver",
};

function paintCar(car, color) {
  car.carColor = color;
}
```

**Good:**

```javascript
const Car = {
  make: "Mercedes",
  model: "GLC",
  color: "Sliver",
};

function paintCar(car, color) {
  car.color = color;
}
```

### Use default parameters instead of short circuiting or conditionals

Default parameters are often cleaner than short circuiting. Be aware that if you
use them, your function will only provide default values for `undefined`
arguments. Other "falsy" values such as `''`, `""`, `false`, `null`, `0`, and
`NaN`, will not be replaced by a default value.

**Bad:**

```javascript
function generateNewName(name) {
  const newName = name || "Hipster Brew Co.";
  // ...
}
```

**Good:**

```javascript
function generateNewName(name = "Hipster Brew Co.") {
  // ...
}
```

## **Functions**

### Function arguments (2 or fewer ideally)

One or two arguments is the ideal case, and three should be avoided if possible.
Anything more than that means your function is trying to do too much and should be consolidated. Most of the time a
higher-level object will suffice as an
argument.

**Bad:**

```javascript
function createMenu(title, body, buttonText, cancellable) {
  // ...
}

createMenu("Form Title", "body text", "Save", true);
```

**Good:**

```javascript
function createMenu({ title, body, buttonText, cancellable }) {
  // ...
}

createMenu({
  title: "Form Title",
  body: "body text",
  buttonText: "Save",
  cancellable: true,
});
```

### Functions should do one thing

When functions do more than one thing, they are harder to compose, test, and reason about.

**Bad:**

```javascript
function emailClients(clients) {
  clients.forEach((client) => {
    const clientRecord = database.lookup(client);
    if (clientRecord.isActive()) {
      email(client);
    }
  });
}
```

**Good:**

```javascript
function emailActiveClients(clients) {
  clients.filter(isActiveClient).forEach(email);
}

function isActiveClient(client) {
  const clientRecord = database.lookup(client);
  return clientRecord.isActive();
}
```

### Function names should say what they do

**Bad:**

```javascript
function addToDate(date, month) {
  // ...
}

const date = new Date();

// It's hard to tell from the function name what is added
addToDate(date, 1);
```

**Good:**

```javascript
function addMonthToDate(month, date) {
  // ...
}

const date = new Date();
addMonthToDate(1, date);
```

### Functions should only be one level of abstraction

When you have more than one level of abstraction your function is usually
doing too much. Splitting up functions leads to reusability and easier
testing.

**Bad:**

```javascript
function parseBetterJSAlternative(code) {
  const REGEXES = [
    // ...
  ];

  const statements = code.split(" ");
  const tokens = [];
  REGEXES.forEach((REGEX) => {
    statements.forEach((statement) => {
      // ...
    });
  });

  const ast = [];
  tokens.forEach((token) => {
    // lex...
  });

  ast.forEach((node) => {
    // parse...
  });
}
```

**Good:**

```javascript
function parseBetterJSAlternative(code) {
  const tokens = tokenize(code);
  const syntaxTree = parse(tokens);
  syntaxTree.forEach((node) => {
    // parse...
  });
}

function tokenize(code) {
  const REGEXES = [
    // ...
  ];

  const statements = code.split(" ");
  const tokens = [];
  REGEXES.forEach((REGEX) => {
    statements.forEach((statement) => {
      tokens.push(/* ... */);
    });
  });

  return tokens;
}

function parse(tokens) {
  const syntaxTree = [];
  tokens.forEach((token) => {
    syntaxTree.push(/* ... */);
  });

  return syntaxTree;
}
```

### Don't use flags as function parameters

Flags tell your user that this function does more than one thing. Functions should do one thing. Split out your
functions if they are following different code paths based on a boolean.

**Bad:**

```javascript
function createFile(name, temp) {
  if (temp) {
    fs.create(`./temp/${name}`);
  } else {
    fs.create(name);
  }
}
```

**Good:**

```javascript
function createFile(name) {
  fs.create(name);
}

function createTempFile(name) {
  createFile(`./temp/${name}`);
}
```

### Use Pure Functions Wherever Possible

**Objective:** Strive to write functions that are pure. A pure function is one that:

- Has No Side Effects: It does not alter any external state (e.g., global variables, disk storage) nor does it depend on
  any external state that is subject to change.
- Returns Consistent Outputs: For the same inputs, it always returns the same outputs, making its behavior predictable
  and testable.

**Bad:**

```javascript
// Bad practice: Impure function with external dependency
let taxRate = 0.07; // External state

function calculateTotalWithTax(prices) {
  return prices.reduce((total, price) => total + price * (1 + taxRate), 0);
}
```

**Good:**

```javascript
// Good practice: Pure function to calculate the total
function calculateTotal(prices, taxRate) {
  return prices.reduce((total, price) => total + price * (1 + taxRate), 0);
}
```

### Encapsulate conditionals

**Bad:**

```javascript
if (state === "fetching" && isEmpty(listNode)) {
  // ...
}
```

**Good:**

```javascript
function shouldShowSpinner(state, listNode) {
  return state === "fetching" && isEmpty(listNode);
}

if (shouldShowSpinner(state, listNodeInstance)) {
  // ...
}
```

### Avoid negative conditionals

**Bad:**

```javascript
function isDOMNodeNotPresent(node) {
  // ...
}

if (!isDOMNodeNotPresent(node)) {
  // ...
}
```

**Good:**

```javascript
function isDOMNodePresent(node) {
  // ...
}

if (isDOMNodePresent(node)) {
  // ...
}
```

## **Architecture**

### Separation of Concerns (Mandatory)

Every component, module, and function should have a single, clear responsibility. Mixing UI rendering, business logic, data fetching, and state management in the same place leads to code that's hard to read, test, and maintain.

**Rules:**

- UI components handle rendering and user interaction only — no business logic, no direct API calls, no complex state transformations inline.
- Business logic lives in dedicated hooks, services, or utility modules.
- Data fetching and API calls go through a service/data layer — not scattered inside components.
- State management stays in its own layer (store, context, or custom hooks) — not tangled with UI code.

**Bad:**

```tsx
// Component doing everything at once
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        // Business logic mixed with data fetching
        const fullName = `${data.firstName} ${data.lastName}`;
        const isEligible = data.age >= 18 && data.verified;
        setUser({ ...data, fullName, isEligible });
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1>{user.fullName}</h1>
      {user.isEligible && <Badge>Eligible</Badge>}
    </div>
  );
}
```

**Good:**

```tsx
// Service layer — data fetching
async function fetchUser(userId) {
  const res = await apiClient.get(`/users/${userId}`);
  return res.data;
}

// Utils — business logic
function formatUserDisplay(user) {
  return {
    fullName: `${user.firstName} ${user.lastName}`,
    isEligible: user.age >= 18 && user.verified,
  };
}

// Hook — orchestration
function useUser(userId) {
  return useQuery(["user", userId], () => fetchUser(userId), {
    select: formatUserDisplay,
  });
}

// Component — rendering only
function UserProfile({ userId }) {
  const { data: user, isLoading } = useUser(userId);

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1>{user.fullName}</h1>
      {user.isEligible && <Badge>Eligible</Badge>}
    </div>
  );
}
```

### DRY — Don't Repeat Yourself (Mandatory)

Duplication is a smell. When the **same logic, pattern, or markup** appears in more than one place, extract it. Copy-paste across files is how drift, inconsistency, and silent bugs get in — fix one call site, forget the other, ship a regression.

**Triggers for extraction:**

- The same utility function body appears in 2+ files → move it to `src/utils/*.util.ts`.
- The same JSX structure appears in 2+ components (e.g., icon-or-fallback avatar, status pill, loading row) → extract a reusable component under `src/components/shared/` (or the relevant feature folder).
- The same data-fetch + cache pattern repeats (e.g., fetch media by ID, localStorage-cache the URL, fall back on failure) → extract into a hook or a shared component that owns the full pattern.
- The same string constants or config repeat (status colors, frequency labels, palette arrays) → hoist to a single module and import from it.

**Before adding a new list cell, widget, or helper — search the codebase first.** If a similar thing already exists, reuse or extend it. If it *almost* fits but not quite, refactor the existing one to be configurable rather than creating a sibling that drifts.

**Rule of three — but don't wait for it when the pattern is obvious.** A one-off is fine. Two near-copies is a warning — extract on the second copy if the shared shape is stable. Three copies is a failure of review.

**Bad — duplicated utility and markup across two cells:**

```tsx
// ExpenseNameCell.tsx
function getColorFromName(name: string): string {
  const colors = ["#8B5CF6", "#EC4899", /* ... */];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const ExpenseNameCell = ({ rowData }) => {
  // ... same logo-or-initial + link markup
};

// ProjectNameCell.tsx  ← near-identical copy
function getColorFromName(name: string): string { /* same body */ }

const ProjectNameCell = ({ rowData }) => {
  // ... same logo-or-initial + link markup, different field paths
};
```

**Good — one util, one primitive, thin per-collection wrappers:**

```ts
// src/utils/color.util.ts
export function getColorFromName(name: string): string { /* ... */ }
```

```tsx
// src/components/shared/MediaAvatar.tsx
// Owns: populated Media → <Image>, bare ID → fetch + localStorage cache, null → colored initial
export const MediaAvatar = ({ name, media, size }: MediaAvatarProps) => { /* ... */ };
```

```tsx
// src/components/Buttons/NamedLogoLinkCell.tsx
// Composes MediaAvatar + name + Link into a list-cell row
export const NamedLogoLinkCell = ({ name, media, href }: Props) => (
  <Link href={href} className="flex items-center gap-2 underline text-inherit">
    <MediaAvatar name={name} media={media} />
    <span>{name}</span>
  </Link>
);
```

```tsx
// ExpenseNameCell — now trivial, just field plumbing
const ExpenseNameCell = ({ rowData }) => (
  <NamedLogoLinkCell
    name={rowData.expenseName}
    media={rowData.expenseLogo}
    href={`/admin/collections/expenses/${rowData.id}`}
  />
);
```

**What NOT to abstract:**

- Don't extract a shared component for a pattern that appears **once**. Wait for the second use.
- Don't force unrelated components under the same abstraction just because they look similar at a glance. If `MediaAvatar` and `UserAvatar` need genuinely different rendering logic, keep them separate — false reuse is worse than duplication.
- Don't over-parameterize. If the abstraction grows past ~4 props or needs boolean flags to switch modes (see "Don't use flags as function parameters"), that's a sign you're merging two things that should stay apart.

**Rule of thumb:** if you're about to paste code from one file into another, stop and extract it first.

---

### SOLID Principles (Applied Practically)

Apply SOLID where it improves clarity and maintainability — not as a dogma. If following a principle makes the code harder to read or slower to ship without real benefit, skip it.

**Single Responsibility**

Each module, component, or function does one thing. If a function name needs "and" to describe what it does, split it.

**Open/Closed**

Prefer extending behavior over modifying existing working code. When adding a new variant or case, extend — don't rewrite what already works.

**Liskov Substitution / Interface Segregation**

Keep interfaces small and focused. Don't force consumers to depend on things they don't use.

**Bad:**

```typescript
// Bloated interface — forces every implementation to handle everything
interface DataHandler {
  fetchData(): Promise<any>;
  transformData(data: any): any;
  validateData(data: any): boolean;
  cacheData(data: any): void;
  logData(data: any): void;
}
```

**Good:**

```typescript
// Small, focused interfaces
interface Fetcher {
  fetch(): Promise<any>;
}

interface Validator {
  validate(data: any): boolean;
}

interface Cache {
  set(key: string, data: any): void;
  get(key: string): any;
}
```

**Dependency Inversion**

Depend on abstractions where it matters (service layers, API clients) — but don't over-abstract for the sake of it.

**Bad:**

```typescript
// Tightly coupled to a specific implementation
class OrderService {
  async createOrder(data) {
    const response = await fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  }
}
```

**Good:**

```typescript
// Depends on an abstraction — easy to swap, test, or mock
class OrderService {
  constructor(private apiClient: ApiClient) {}

  async createOrder(data) {
    return this.apiClient.post("/orders", data);
  }
}
```

---

## **Security**

### Frontend Input Sanitization (Mandatory)

All user inputs must be sanitized before use. Never render or send raw user input without validation.

**Rules:**

- Validate and sanitize on the client side as a first line of defense (format, length, allowed characters).
- Never trust client-side validation alone — it's UX, not security. Always validate on the server too.
- Never use `dangerouslySetInnerHTML` with unsanitized content.
- Sanitize URL parameters and query strings before using them.

**Bad:**

```tsx
// Raw user input rendered directly — XSS vulnerability
function Comment({ comment }) {
  return <div dangerouslySetInnerHTML={{ __html: comment.body }} />;
}

// Unsanitized URL param used in a query
const searchTerm = new URLSearchParams(window.location.search).get("q");
fetch(`/api/search?q=${searchTerm}`);
```

**Good:**

```tsx
import DOMPurify from "dompurify";

// Sanitized before rendering
function Comment({ comment }) {
  const sanitizedBody = DOMPurify.sanitize(comment.body);
  return <div dangerouslySetInnerHTML={{ __html: sanitizedBody }} />;
}

// URL param sanitized and encoded
const searchTerm = new URLSearchParams(window.location.search).get("q");
const sanitized = encodeURIComponent(searchTerm?.trim() ?? "");
fetch(`/api/search?q=${sanitized}`);
```

### Backend API Security (Mandatory)

**Rate Limiting**

All public-facing API endpoints must have rate limiting applied. No exceptions. If an endpoint is exposed to the internet, it needs protection against abuse.

**Authentication and Authorization**

Every protected route must verify the user's identity and permissions. No endpoint should assume the request is legitimate just because it reached the server.

**Server-Side Validation**

Never trust the client. All inputs must be validated and sanitized on the server side regardless of any client-side validation.

**Bad:**

```typescript
// No rate limiting, no input validation, trusting the client blindly
app.post("/api/comments", async (req, res) => {
  const { body, userId } = req.body;
  await db.comments.create({ body, userId });
  res.json({ success: true });
});
```

**Good:**

```typescript
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
});

const commentSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});

app.post("/api/comments", commentLimiter, authMiddleware, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  await db.comments.create({
    body: parsed.data.body,
    userId: req.user.id, // From auth middleware, not from request body
  });

  res.json({ success: true });
});
```

**Parameterized Queries**

Never build SQL queries with string concatenation. Always use parameterized queries or an ORM that handles this for you.

**Error Responses**

Never leak internal details (stack traces, DB schemas, internal paths) in error responses sent to the client. Return generic error messages and log the details server-side.

---

## **Error Handling**

### Global Error Boundaries (Mandatory)

Components should fail gracefully — not crash the entire page. Wrap critical sections with error boundaries so a failure in one part of the UI doesn't take down everything else.

```tsx
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong.</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Wrap sections that can fail independently
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <UserProfile />
</ErrorBoundary>;
```

### API Error Handling (Mandatory)

API errors must follow a consistent format. Use proper HTTP status codes. Never swallow errors silently — always handle them explicitly.

**Bad:**

```typescript
// Swallowed error — no feedback, no logging
async function fetchUser(id) {
  try {
    const res = await apiClient.get(`/users/${id}`);
    return res.data;
  } catch (e) {
    // silently fails
    return null;
  }
}
```

**Good:**

```typescript
// Consistent error handling with proper feedback
async function fetchUser(id) {
  try {
    const res = await apiClient.get(`/users/${id}`);
    return res.data;
  } catch (error) {
    logger.error("Failed to fetch user", { userId: id, error });

    if (error.response?.status === 404) {
      throw new NotFoundError(`User ${id} not found`);
    }

    throw new ApiError("Failed to load user data. Please try again.");
  }
}
```

### User-Facing Error States (Mandatory)

No blank screens on failure. Every component that loads data or performs async operations must have a meaningful error state that tells the user what happened and what they can do about it.

**Bad:**

```tsx
// Blank screen on error — user has no idea what happened
function Dashboard() {
  const { data, error } = useDashboardData();

  if (error) return null;

  return <DashboardContent data={data} />;
}
```

**Good:**

```tsx
// Clear error state with recovery action
function Dashboard() {
  const { data, error, refetch } = useDashboardData();

  if (error) {
    return (
      <ErrorState
        message="We couldn't load the dashboard. Please try again."
        onRetry={refetch}
      />
    );
  }

  return <DashboardContent data={data} />;
}
```

---

## **Testing**

### Single concept per test

**Bad:**

```javascript
import { format, addDays, parse } from "date-fns";

describe("date-fns", () => {
  it("handles date boundaries", () => {
    let date;

    date = parse("1/1/2024", "M/d/yyyy", new Date());
    date = addDays(date, 30);
    expect(format(date, "M/d/yyyy")).toEqual("1/31/2024");

    date = parse("2/1/2024", "M/d/yyyy", new Date());
    date = addDays(date, 28);
    expect(format(date, "M/d/yyyy")).toEqual("2/29/2024");

    date = parse("2/1/2024", "M/d/yyyy", new Date());
    date = addDays(date, 28);
    expect(format(date, "M/d/yyyy")).toEqual("3/1/2024");
  });
});
```

**Good:**

```javascript
import { format, addDays, parse } from "date-fns";

describe("date-fns", () => {
  it("handles 30-day months", () => {
    let date = parse("1/1/2024", "M/d/yyyy", new Date());
    date = addDays(date, 30);
    expect(format(date, "M/d/yyyy")).toEqual("1/31/2024");
  });

  it("handles leap year", () => {
    let date = parse("2/1/2024", "M/d/yyyy", new Date());
    date = addDays(date, 28);
    expect(format(date, "M/d/yyyy")).toEqual("2/29/2024");
  });

  it("handles non-leap year", () => {
    let date = parse("2/1/2024", "M/d/yyyy", new Date());
    date = addDays(date, 28);
    expect(format(date, "M/d/yyyy")).toEqual("3/1/2024");
  });
});
```

### Accessible Queries

Consider mimicking the user for more realistic interaction simulation and future proofness ..

**Fine:**

```javascript
// Instead of
const element = screen.getByTestId("element-id");
```

**Better:**

```javascript
// Use
const element = screen.getByRole("textbox", { name: /element label/i });
```

### Mock Data Management

If our mock data expands, consider moving it to a dedicated file for better organization.

```javascript
// mockData.js
export const mockPickup = {
  formatted_address: "P. Sherman, 42 Wallaby Way, Sydney",
};

export const mockDestination = {
  formatted_address: "221B Baker Street",
};
```

### Dynamic Behavior Tests

Add tests for dynamic behaviors like conditional rendering.

```javascript
it("renders alternative text when address is not provided", () => {
  render(<KidnapNemo pickup={{}} destination={{}} />);
  expect(screen.getByText("No address provided")).toBeInTheDocument();
});
```

### Error Handling

Ensure error states or edge cases are managed gracefully.

```javascript
it("displays error message on incomplete data", () => {
  render(<RescueNemo pickup={null} destination={null} />);
  expect(screen.getByText("Error loading addresses")).toBeInTheDocument();
});
```

### Reducing Repetition

Use **beforeEach** for setup steps that are common across multiple tests.

```javascript
beforeEach(() => {
  render(<MyComponent pickup={mockPickup} destination={mockDestination} />);
});
```

### Context Integration

Test how the component behaves under different context providers.

```javascript
it("renders correctly under different contexts", () => {
  render(
    <UserContext.Provider value={mockUser}>
      <MyComponent pickup={mockPickup} destination={mockDestination} />
    </UserContext.Provider>
  );
  expect(screen.getByText(mockUser.name)).toBeInTheDocument();
});
```

### Performance Assertions

Monitor performance to ensure it remains within acceptable boundaries.

```javascript
it('renders efficiently', () => {
    const { container } = render(<FindNemo... />);
    expect(performance.now() - startTime).toBeLessThan(200);
});
```

### Accessibility Checks

Utilize tools like jest-axe to ensure accessibility compliance.

```javascript
import { axe } from 'jest-axe';

it('is accessible', async () => {
    const { container } = render(<FindNemo... />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
});

```

### Modular Test Design

Break tests into smaller, more specific cases to avoid monolithic test functions and enhance clarity.

```javascript
it("should display the default image when no image is provided", () => {
  render(<ImageComponent />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "default-image.png");
});
```

### Parameterized Tests

Use parameterized tests for scenarios where you need to run the same test logic with different data. This reduces redundancy and increases the comprehensiveness of your tests.

```javascript
const inputs = [
  { input: "data1", expected: "result1" },
  { input: "data2", expected: "result2" },
];
inputs.forEach(({ input, expected }) => {
  it(`properly handles ${input}`, () => {
    expect(processInput(input)).toBe(expected);
  });
});
```

### Get enough coverage for being confident, ~80% seems to be the lucky number

The purpose of testing is to get enough confidence for moving fast, obviously the more code is tested the more confident
the team can be:

- 10–30% is obviously too low to get any sense about the build correctness
- 100% is very expensive and might shift your focus from the critical paths to the exotic corners of the code
- 70–90% is a good balance between the confidence and the cost

## **PR Hygiene and Code Quality**

### Commit Messages

Use meaningful commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format. A commit message should explain **why** the change was made, not just what changed.

**Bad:**

```
fix stuff
update code
changes
```

**Good:**

```
fix(auth): prevent token refresh loop on expired sessions
feat(dashboard): add weekly revenue chart to analytics page
refactor(api): extract validation logic into shared middleware
```

### Keep PRs Focused

No unrelated changes sneaked into a PR. A PR should do one thing. If you spot something unrelated that needs fixing, open a separate PR for it. Mixing concerns in PRs makes reviews harder and increases the risk of shipping bugs.

### No Debug Leftovers

Remove all `console.log`, `console.debug`, `debugger` statements, and any other debug artifacts before opening a PR. Use proper logging (e.g., Sentry, a logger utility) for anything that needs to persist.

### No Commented-Out Code

If code is not needed, delete it. Version control exists for a reason. Commented-out blocks clutter the codebase and confuse future readers about intent.

### Secrets and Environment Variables

- Never commit secrets, API keys, tokens, or credentials to the repository.
- Use `.env` files for environment-specific configuration and make sure `.env` is in `.gitignore`.
- Flag any hardcoded URLs, API endpoints, or config values that should come from environment variables.

### Dependencies

- Before adding a new dependency, check if something already in the project solves the problem.
- Flag heavy packages added for trivial use cases. If you're importing a 50KB library to format a single date, reconsider.
- Every new dependency is a maintenance and security liability — it should earn its place.

---

## Agreements

### Team Agreements and Decisions

Below is a table of the agreements and decisions that the team has already made:

| Decision                     | Details                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Package Manager              | Yarn                                                                                  |
| Linting                      | Eslint                                                                                |
| Formatter                    | Prettier                                                                              |
| Styling                      | Tailwind CSS                                                                          |
| Component Library            | [Shadcn UI](https://ui.shadcn.com/)                                                   |
| Pull Request Template        | [This template](./resources/pull_request_template.md)                                 |
| Git Ignore                   | [This template](./resources/.gitignore)                                               |
| Commit Message               | Use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format |
| Branch Naming Convention     | `<ticket_number>-<ticket_name>` Example: `CMB-123-add-login-button`                   |
| Code Review                  | At least one team member must approve the PR before merging                           |
| Code Quality Tool            | SonarQube                                                                             |
| Error Tracking and Logging   | Sentry                                                                                |
| Next.js Internationalization | [next-intl](https://next-intl-docs.vercel.app/)                                       |
| Testing Framework            | Jest                                                                                  |
| Form Handling                | [React Hook Form](https://react-hook-form.com/)                                       |
| State Management             | [Redux Toolkit](https://redux-toolkit.js.org/)                                        |
| Data Cache                   | [React Query](https://react-query.tanstack.com/)                                      |
| Mocking Library              | [MSW](https://mswjs.io/)                                                              |
| Data Validation              | [Zod](https://zod.dev/)                                                               |
| API Client                   | [Axios](https://axios-http.com/)                                                      |
| Date and Time Handling       | [date-fns](https://date-fns.org/) (In case we need advanced date handling only)       |

## References

Some suggested libraries and tools to use in the projects:

| Purpose           | Details                                                           |
| ----------------- | ----------------------------------------------------------------- |
| Drag and Drop     | [Swapy](https://swapy.tahazsh.com/)                               |
| Charts            | [Chart.js](https://www.chartjs.org/)                              |
| Onboarding        | [Driver.js](https://driverjs.com/)                                |
| Toasts            | [React Hot Toast](https://react-hot-toast.com/)                   |
| React Hooks       | [useHooks](https://usehooks.com/)                                 |
| Simple Animations | [React Awesome Reveal](https://react-awesome-reveal.morello.dev/) |
