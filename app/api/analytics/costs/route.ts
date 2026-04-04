import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0837: Cost per call
 * F0838: Cost per booking
 * F0840: ROI calculation
 *
 * GET /api/analytics/costs - Comprehensive cost analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    // Get all calls with costs
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, cost_usd, outcome')
      .gte('started_at', startDate)
      .lte('started_at', endDate)
      .not('cost_usd', 'is', null);

    if (callsError) throw callsError;

    // Get all bookings
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, call_id, revenue_usd')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (bookingsError) throw bookingsError;

    // Calculate total costs
    const totalCost = calls?.reduce((sum, call) => sum + (Number(call.cost_usd) || 0), 0) || 0;
    const avgCostPerCall = calls && calls.length > 0 ? totalCost / calls.length : 0;

    // Calculate cost per booking
    const totalBookings = bookings?.length || 0;
    const costPerBooking = totalBookings > 0 ? totalCost / totalBookings : 0;

    // Calculate revenue
    const totalRevenue = bookings?.reduce((sum, b) => sum + (Number(b.revenue_usd) || 0), 0) || 0;
    const avgRevenuePerBooking = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Calculate ROI
    const profit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    // Success rate
    const successfulCalls = calls?.filter((c) => ['success', 'completed', 'resolved'].includes(c.outcome)).length || 0;
    const successRate = calls && calls.length > 0 ? (successfulCalls / calls.length) * 100 : 0;

    return NextResponse.json({
      costs: {
        total_cost_usd: parseFloat(totalCost.toFixed(4)),
        avg_cost_per_call: parseFloat(avgCostPerCall.toFixed(4)),
        cost_per_booking: parseFloat(costPerBooking.toFixed(4)),
      },
      revenue: {
        total_revenue_usd: parseFloat(totalRevenue.toFixed(2)),
        avg_revenue_per_booking: parseFloat(avgRevenuePerBooking.toFixed(2)),
      },
      roi: {
        profit_usd: parseFloat(profit.toFixed(2)),
        roi_percentage: parseFloat(roi.toFixed(2)),
        break_even: profit >= 0,
      },
      volume: {
        total_calls: calls?.length || 0,
        total_bookings: totalBookings,
        success_rate: parseFloat(successRate.toFixed(2)),
      },
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error calculating costs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate costs' },
      { status: 500 }
    );
  }
}
