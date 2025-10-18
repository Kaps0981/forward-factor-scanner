import os
import requests
from datetime import datetime
from flask import Blueprint, jsonify
from collections import defaultdict

options_bp = Blueprint('options', __name__)

# Get API key from environment variable
POLYGON_API_KEY = os.environ.get('POLYGON_API_KEY')

@options_bp.route('/lookup/<ticker>', methods=['GET'])
def lookup_options(ticker):
    """
    Lookup options data for a given ticker symbol.
    Returns IV and DTE for front and back month contracts.
    """
    try:
        if not POLYGON_API_KEY:
            return jsonify({'error': 'Polygon API key not configured'}), 500
        
        # Get current date
        today = datetime.now().date()
        
        # Use the direct REST API endpoint for options chain snapshot
        url = f'https://api.polygon.io/v3/snapshot/options/{ticker.upper()}'
        params = {
            'apiKey': POLYGON_API_KEY,
            'limit': 250
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 403:
                return jsonify({
                    'error': 'Access denied. This feature requires a Polygon.io subscription with options data access.'
                }), 403
            elif response.status_code == 429:
                return jsonify({
                    'error': 'Rate limit exceeded. Please wait a moment and try again.'
                }), 429
            elif response.status_code != 200:
                return jsonify({
                    'error': f'API returned status code {response.status_code}: {response.text}'
                }), response.status_code
            
            data = response.json()
            
            if data.get('status') != 'OK' or 'results' not in data:
                return jsonify({
                    'error': f'No options data found for {ticker}'
                }), 404
            
            # Group options by expiration date and collect IVs
            expirations_data = defaultdict(list)
            
            for option in data['results']:
                # Check if we have the required data
                if 'details' not in option or 'implied_volatility' not in option:
                    continue
                
                details = option['details']
                exp_date = details.get('expiration_date')
                iv = option.get('implied_volatility')
                
                # Only include valid IVs and future expirations
                if iv and iv > 0 and exp_date:
                    exp_datetime = datetime.strptime(exp_date, '%Y-%m-%d').date()
                    if exp_datetime > today:
                        expirations_data[exp_date].append(iv)
            
            if len(expirations_data) < 2:
                return jsonify({
                    'error': f'Need at least 2 expiration dates with valid IV data for {ticker}. Found {len(expirations_data)}.'
                }), 404
            
            # Sort expiration dates
            sorted_expirations = sorted(expirations_data.keys())
            
            # Get the two nearest expirations
            front_exp = sorted_expirations[0]
            back_exp = sorted_expirations[1]
            
            # Calculate average IV for each expiration (more robust than single contract)
            front_ivs = expirations_data[front_exp]
            back_ivs = expirations_data[back_exp]
            
            front_iv = sum(front_ivs) / len(front_ivs)
            back_iv = sum(back_ivs) / len(back_ivs)
            
            # Calculate DTE for each expiration
            front_dte = (datetime.strptime(front_exp, '%Y-%m-%d').date() - today).days
            back_dte = (datetime.strptime(back_exp, '%Y-%m-%d').date() - today).days
            
            # Return the data (convert IV to percentage)
            return jsonify({
                'ticker': ticker.upper(),
                'front_contract': {
                    'iv': round(front_iv * 100, 2),  # Convert to percentage
                    'dte': front_dte,
                    'expiration': front_exp,
                    'sample_size': len(front_ivs)
                },
                'back_contract': {
                    'iv': round(back_iv * 100, 2),  # Convert to percentage
                    'dte': back_dte,
                    'expiration': back_exp,
                    'sample_size': len(back_ivs)
                }
            })
            
        except requests.exceptions.Timeout:
            return jsonify({
                'error': 'Request timed out. Please try again.'
            }), 504
        except requests.exceptions.RequestException as e:
            return jsonify({
                'error': f'Network error: {str(e)}'
            }), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

