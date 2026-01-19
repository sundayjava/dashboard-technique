# Analytics System Documentation

## Overview
Professional analytics dashboards with industrial-standard charts and visualizations for both admin and user portfolio tracking.

## Technology Stack
- **Recharts**: Professional React charting library
- **Chart Types**: Area, Bar, Line, Pie charts
- **Styling**: Tailwind CSS with gradient designs
- **Icons**: Lucide React
- **Data Fetching**: Axios

---

## Admin Analytics Dashboard

### Location
`/admin/analytics`

### Features

#### KPI Cards (4 Gradient Cards)
1. **Total Users** (Blue Gradient)
   - Shows total user count
   - Monthly growth indicator
   - Users icon

2. **Total Invested** (Green Gradient)
   - Total amount invested across platform
   - Investment count
   - Dollar Sign icon

3. **Total Returns** (Purple Gradient)
   - Total returns paid out
   - Profit breakdown
   - Trending Up icon

4. **Average ROI** (Orange Gradient)
   - Platform-wide average ROI percentage
   - Active investors count
   - Award icon

#### Charts (7 Visualizations)

1. **Monthly Performance Trends** (Area Chart)
   - Dual gradient areas for revenue and investment count
   - 6-month historical data
   - Blue gradient for revenue, green for investments

2. **Investment Status Distribution** (Pie Chart)
   - Breakdown by status: PENDING, ACTIVE, COMPLETED, CANCELLED, FAILED
   - Percentage labels on segments
   - 6-color scheme

3. **Top Investment Plans** (Bar Chart)
   - Top 5 performing plans
   - Dual bars: total amount invested + investment count
   - Rounded bar corners

4. **Payment Method Distribution** (Pie Chart)
   - Bank Wallet vs Crypto breakdown
   - Percentage display

5. **User & Investment Growth** (Line Chart)
   - Dual Y-axes
   - Purple line: new users (left axis)
   - Green line: completed investments (right axis)
   - 6-month trend

#### Summary Statistics (3 Cards)
1. **30-Day Activity** (Blue Border)
   - New investments last 30 days
   - Revenue last 30 days

2. **Platform Health** (Green Border)
   - Active investment plans count
   - Total trade keys

3. **Performance Metrics** (Purple Border)
   - Completed investments count
   - Total profit generated

### API Endpoint
```
GET /api/admin/analytics
```

#### Response Structure
```typescript
{
  overview: {
    totalUsers: number;
    totalInvestments: number;
    totalInvested: number;
    totalReturns: number;
    totalPlans: number;
    totalTradeKeys: number;
    activeInvestors: number;
  };
  recentActivity: {
    newUsersLast30Days: number;
    newInvestmentsLast30Days: number;
    revenueLast30Days: number;
  };
  statusBreakdown: {
    PENDING: number;
    ACTIVE: number;
    COMPLETED: number;
    CANCELLED: number;
    FAILED: number;
  };
  revenueByStatus: {
    PENDING: number;
    ACTIVE: number;
    COMPLETED: number;
  };
  topPlans: Array<{
    planName: string;
    totalInvestments: number;
    totalAmount: number;
    avgAmount: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    investments: number;
    revenue: number;
    newUsers: number;
    completedInvestments: number;
  }>;
  paymentMethods: {
    BANK_WALLET: number;
    CRYPTO: number;
  };
  performance: {
    avgROI: number;
    completedInvestments: number;
    totalProfit: number;
  };
}
```

---

## User Portfolio Analytics Dashboard

### Location
`/investment/analytics`

### Features

#### KPI Cards (4 Gradient Cards)
1. **Total Invested** (Blue Gradient)
   - User's total investment amount
   - Total investment count

2. **Active Value** (Green Gradient)
   - Current value of active investments
   - Active investment count

3. **Total Returns** (Purple Gradient)
   - Total returns received
   - Profit earned indicator
   - Trending arrow (up/down)

4. **Return on Investment** (Orange Gradient)
   - Personal ROI percentage
   - Success rate

#### Charts (5 Visualizations)

1. **Monthly Investment Performance** (Area Chart)
   - Dual gradient areas
   - Blue: Amount invested per month
   - Green: Returns received per month
   - 6-month history

2. **Investment Status** (Pie Chart)
   - Distribution by status
   - Percentage labels
   - 5-color scheme

3. **Investment by Plan** (Bar Chart)
   - Breakdown by investment plan
   - Dual bars: amount invested + profit earned
   - Rounded corners

4. **Profit Growth Trend** (Line Chart)
   - Monthly profit progression
   - Green line with active dots
   - 6-month trend

#### Active Investments Progress
- Progress bars for each active investment
- Completion percentage
- Days remaining countdown
- Expected profit and return display
- Start and end dates
- Responsive card layout

#### Summary Cards (3 Bordered Cards)
1. **Expected Returns** (Blue Border)
   - Total expected returns from active investments
   - Active investment count

2. **Average Investment** (Green Border)
   - Average investment size
   - Per investment metric

3. **Completed Investments** (Purple Border)
   - Count of completed investments
   - Success rate percentage

### API Endpoint
```
GET /api/user/portfolio-analytics?userId={userId}
```

#### Response Structure
```typescript
{
  overview: {
    totalInvested: number;
    activeValue: number;
    totalReturns: number;
    totalProfit: number;
    expectedReturns: number;
    roi: number;
    avgInvestmentSize: number;
    successRate: number;
  };
  counts: {
    total: number;
    active: number;
    completed: number;
    pending: number;
  };
  statusDistribution: Record<string, number>;
  planDistribution: Record<string, {
    count: number;
    amount: number;
    profit: number;
  }>;
  monthlyPerformance: Array<{
    month: string;
    invested: number;
    returns: number;
    profit: number;
    count: number;
  }>;
  activeInvestments: Array<{
    id: string;
    planName: string;
    amount: number;
    progress: number; // percentage
    daysRemaining: number;
    expectedProfit: number;
    expectedReturn: number;
    startDate: string;
    endDate: string;
  }>;
  recentInvestments: Array<{
    id: string;
    planName: string;
    amount: number;
    status: string;
    createdAt: string;
    profitEarned: number | null;
  }>;
}
```

---

## Navigation

### Admin Navigation
The Analytics link is available in the admin dashboard sidebar:
- **Path**: `/admin/analytics`
- **Icon**: Bar chart icon
- **Access**: Admin role required

### Investment Navigation
The Analytics link is available in the investment sidebar:
- **Path**: `/investment/analytics`
- **Icon**: Bar chart icon
- **Access**: Authenticated users

---

## Design Principles

### Color Scheme
Professional 6-color palette:
- Blue: `#3b82f6` - Primary, Revenue, Users
- Green: `#10b981` - Success, Returns, Profit
- Orange: `#f59e0b` - Warning, ROI
- Red: `#ef4444` - Error, Failed
- Purple: `#8b5cf6` - Special, Analytics
- Pink: `#ec4899` - Accent

### Gradient Design
- KPI cards use `gradient-to-br` (bottom-right direction)
- Progress bars use `gradient-to-r` (right direction)
- Opacity variations for depth: 0.8 at start, 0 at end

### Responsive Design
- All charts wrapped in `ResponsiveContainer`
- Grid layouts adapt to screen size
- Mobile-first approach
- Breakpoints: `md:`, `lg:` for tablets and desktops

### Typography
- Headers: `text-3xl font-bold`
- Subheaders: `text-xl font-bold`
- Labels: `text-sm font-medium`
- Values: Large, bold numbers
- Context: Small, gray text

---

## Data Calculations

### ROI Calculation
```typescript
roi = ((totalReturns - totalInvested) / totalInvested) * 100
```

### Success Rate
```typescript
successRate = (completedInvestments / totalInvestments) * 100
```

### Progress Percentage
```typescript
const now = new Date();
const start = new Date(investment.startDate);
const end = new Date(investment.endDate);
const totalDuration = end - start;
const elapsed = now - start;
progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
```

### Days Remaining
```typescript
const now = new Date();
const end = new Date(investment.endDate);
daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
```

### Expected Returns
```typescript
expectedReturn = investment.amount + expectedProfit;
expectedProfit = (investment.amount * investment.plan.returnPercentage) / 100;
```

---

## Performance Considerations

### Data Fetching
- Axios for API calls
- Loading states with spinners
- Error handling with fallback UI
- useEffect for automatic data fetch on mount

### Optimization
- Memoization recommended for chart data processing
- Consider caching analytics data (5-15 minute TTL)
- Lazy loading for large investment lists
- Pagination for active investments if > 20 items

### Future Enhancements
1. Real-time updates with WebSocket
2. Date range filters
3. Export to CSV/PDF
4. Comparison views (month-over-month, year-over-year)
5. Custom dashboard layouts
6. Drill-down capabilities (click chart for details)
7. Performance benchmarking against market

---

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Recharts requires SVG support
- CSS Grid and Flexbox for layouts
- Tailwind CSS for consistent styling

---

## Accessibility
- Semantic HTML structure
- ARIA labels on interactive elements
- Color contrast ratios meet WCAG standards
- Keyboard navigation support
- Screen reader friendly chart tooltips

---

## Testing Checklist
- [ ] Admin analytics loads with real data
- [ ] User portfolio analytics loads with userId
- [ ] All 7 admin charts render correctly
- [ ] All 5 user charts render correctly
- [ ] Loading states display
- [ ] Error states handle gracefully
- [ ] Responsive on mobile devices
- [ ] KPI cards show correct values
- [ ] Progress bars animate smoothly
- [ ] Tooltips display on chart hover
- [ ] Navigation links work
- [ ] Data refreshes on page reload

---

## Troubleshooting

### Charts Not Rendering
- Check if Recharts is installed: `npm list recharts`
- Verify data format matches expected structure
- Check browser console for errors
- Ensure ResponsiveContainer has height defined

### API Errors
- Verify userId is passed for user analytics
- Check API endpoint returns 200 status
- Validate data structure in network tab
- Ensure authentication token is valid

### Styling Issues
- Clear Tailwind cache: `npm run build`
- Check Tailwind config includes all color classes
- Verify gradient classes are supported
- Test in different browsers

---

## Maintenance

### Regular Updates
- Review analytics calculations monthly
- Update color schemes for accessibility
- Optimize queries if slow (>2s load time)
- Add new charts based on user feedback

### Monitoring
- Track API response times
- Monitor error rates
- Analyze user engagement with analytics
- Collect feedback for improvements

---

## Credits
- **Charts**: Recharts library
- **Icons**: Lucide React
- **Styling**: Tailwind CSS
- **Framework**: Next.js 14
- **Language**: TypeScript

---

**Last Updated**: December 2024
**Version**: 1.0.0
