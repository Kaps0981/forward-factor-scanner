import { type Opportunity } from '@shared/schema';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    console.warn('Email alerts unavailable: X_REPLIT_TOKEN not found');
    return null;
  }

  try {
    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    if (!connectionSettings || !connectionSettings.settings.api_key) {
      console.warn('Email alerts unavailable: Resend not connected');
      return null;
    }
    
    return {
      apiKey: connectionSettings.settings.api_key, 
      fromEmail: connectionSettings.settings.from_email
    };
  } catch (error) {
    console.error('Failed to get Resend credentials:', error);
    return null;
  }
}

export async function sendHighFFAlert(opportunities: Opportunity[]) {
  try {
    const credentials = await getCredentials();
    if (!credentials) {
      return; // Silently skip if email not configured
    }

    // Import dynamically to avoid errors if not configured
    const { Resend } = await import('resend');
    const resend = new Resend(credentials.apiKey);

    // Filter for high |FF| opportunities (> 40%)
    const highFFOpps = opportunities.filter(opp => Math.abs(opp.forward_factor) > 40);
    
    if (highFFOpps.length === 0) {
      return; // No high FF opportunities to report
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
          🎯 High Forward Factor Opportunities Found
        </h2>
        
        <p style="color: #666; margin: 20px 0;">
          Your scan found ${highFFOpps.length} high-value opportunities with |FF| > 40%:
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb;">Ticker</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">FF %</th>
              <th style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">Signal</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">Front DTE</th>
            </tr>
          </thead>
          <tbody>
            ${highFFOpps.map(opp => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6;">
                  <strong>${opp.ticker}</strong>
                  ${opp.has_earnings_soon ? '⚠️' : ''}
                </td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f3f4f6; color: ${opp.forward_factor < 0 ? '#16a34a' : '#dc2626'};">
                  <strong>${opp.forward_factor > 0 ? '+' : ''}${opp.forward_factor}%</strong>
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                  <span style="padding: 4px 8px; border-radius: 4px; background-color: ${opp.signal === 'BUY' ? '#dcfce7' : '#fee2e2'}; color: ${opp.signal === 'BUY' ? '#16a34a' : '#dc2626'};">
                    ${opp.signal}
                  </span>
                </td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f3f4f6;">
                  ${opp.front_dte}d
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 12px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>⚠️ Important:</strong> Verify no earnings announcements before trading. Check liquidity (OI > 100) and use appropriate position sizing.
          </p>
        </div>
        
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          FFQuant | Professional Options Analysis
        </p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: credentials.fromEmail,
      to: credentials.fromEmail, // Send to the configured email
      subject: `🎯 Forward Factor Alert: ${highFFOpps.length} High |FF| Opportunities`,
      html: htmlContent,
    });

    if (error) {
      console.error('Failed to send email alert:', error);
    } else {
      console.log('Email alert sent successfully:', data);
    }
  } catch (error) {
    console.error('Email alert error:', error);
    // Don't throw - email is optional feature
  }
}