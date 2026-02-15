#!/usr/bin/env python3
"""
Paper Trading Engine Backend Test Suite

Tests all key features:
1. Trading Configuration API
2. Trading with Fees & Slippage
3. Weighted Average Entry
4. Account Summary
5. Account Snapshots
6. Trade History
7. Limit Orders
8. Validation Tests
"""

import requests
import json
import time
from typing import Dict, Any

class PaperTradingEngineTests:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.user_credentials = {
            "email": "demo@investdash.com",
            "password": "password123"
        }
        self.authenticated = False
        print(f"🔧 Initialized tests for: {self.base_url}")
    
    def authenticate(self):
        """Login with test user credentials"""
        try:
            # First try to login
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json=self.user_credentials,
                timeout=10
            )
            
            if response.status_code == 200:
                print("✅ Login successful")
                self.authenticated = True
                return True
            elif response.status_code == 401:
                # User doesn't exist, register first
                print("ℹ️ User doesn't exist, registering...")
                reg_response = self.session.post(
                    f"{self.base_url}/api/auth/register",
                    json=self.user_credentials,
                    timeout=10
                )
                
                if reg_response.status_code == 200:
                    print("✅ Registration successful")
                    self.authenticated = True
                    return True
                else:
                    print(f"❌ Registration failed: {reg_response.status_code} - {reg_response.text}")
                    return False
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def test_trading_configuration(self):
        """Test GET /api/config - Trading configuration endpoint"""
        print("\n🔍 Testing Trading Configuration API...")
        
        try:
            response = self.session.get(f"{self.base_url}/api/config", timeout=10)
            
            if response.status_code == 200:
                config = response.json()
                
                # Validate required fields
                required_fields = [
                    'tradingFeePercent', 'minSlippagePercent', 'maxSlippagePercent',
                    'startingBalance', 'maxLeverage', 'minTradeValue'
                ]
                
                missing_fields = [field for field in required_fields if field not in config]
                if missing_fields:
                    print(f"❌ Missing config fields: {missing_fields}")
                    return False
                
                # Validate reasonable values
                if config['tradingFeePercent'] != 0.1:  # 0.1%
                    print(f"❌ Expected trading fee 0.1%, got {config['tradingFeePercent']}%")
                    return False
                
                if config['startingBalance'] != 100000:
                    print(f"❌ Expected starting balance 100000, got {config['startingBalance']}")
                    return False
                
                print(f"✅ Configuration valid: Fee {config['tradingFeePercent']}%, Balance ${config['startingBalance']}")
                return True
            else:
                print(f"❌ Config API failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Config test error: {e}")
            return False
    
    def test_account_summary(self):
        """Test GET /api/account - Account summary endpoint"""
        print("\n📊 Testing Account Summary API...")
        
        try:
            response = self.session.get(f"{self.base_url}/api/account", timeout=10)
            
            if response.status_code == 200:
                account = response.json()
                
                # Validate required fields
                required_fields = [
                    'balance', 'equity', 'positionsValue', 'openPnl', 'realizedPnl', 'totalFeesPaid'
                ]
                
                missing_fields = [field for field in required_fields if field not in account]
                if missing_fields:
                    print(f"❌ Missing account fields: {missing_fields}")
                    return False
                
                # Validate equity calculation
                expected_equity = account['balance'] + account['positionsValue']
                if abs(account['equity'] - expected_equity) > 0.01:  # Allow small floating point differences
                    print(f"❌ Equity mismatch: expected {expected_equity}, got {account['equity']}")
                    return False
                
                print(f"✅ Account Summary: Balance ${account['balance']}, Equity ${account['equity']}")
                return True
            else:
                print(f"❌ Account API failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Account test error: {e}")
            return False
    
    def test_buy_trade_with_fees_slippage(self):
        """Test POST /api/trade - Buy order with fees and slippage verification"""
        print("\n💰 Testing BUY Trade with Fees & Slippage...")
        
        try:
            # Get account balance before trade
            pre_response = self.session.get(f"{self.base_url}/api/account", timeout=10)
            if pre_response.status_code != 200:
                print(f"❌ Failed to get pre-trade account: {pre_response.status_code}")
                return False
            
            pre_account = pre_response.json()
            initial_balance = pre_account['balance']
            
            # Execute BUY order
            trade_data = {
                "symbol": "NVDA",
                "type": "stock",
                "action": "BUY",
                "quantity": 5
            }
            
            response = self.session.post(
                f"{self.base_url}/api/trade",
                json=trade_data,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                trade = result['trade']
                
                # Validate trade response structure
                required_fields = [
                    'marketPrice', 'executedPrice', 'slippage', 'totalValue', 
                    'fee', 'totalDeduction'
                ]
                missing_fields = [field for field in required_fields if field not in trade]
                if missing_fields:
                    print(f"❌ Missing trade fields: {missing_fields}")
                    return False
                
                # Validate fee calculation (0.1% of totalValue)
                expected_fee = trade['totalValue'] * 0.001
                if abs(trade['fee'] - expected_fee) > 0.01:
                    print(f"❌ Fee mismatch: expected {expected_fee}, got {trade['fee']}")
                    return False
                
                # Validate slippage (should be different from market price)
                if trade['executedPrice'] == trade['marketPrice']:
                    print(f"❌ No slippage applied: executed={trade['executedPrice']}, market={trade['marketPrice']}")
                    return False
                
                # Validate totalDeduction includes fee
                expected_deduction = trade['totalValue'] + trade['fee']
                if abs(trade['totalDeduction'] - expected_deduction) > 0.01:
                    print(f"❌ Total deduction mismatch: expected {expected_deduction}, got {trade['totalDeduction']}")
                    return False
                
                print(f"✅ BUY Trade: {trade['quantity']} NVDA at ${trade['executedPrice']}")
                print(f"   📈 Market: ${trade['marketPrice']}, Slippage: {trade['slippage']:.4f}%")
                print(f"   💰 Fee: ${trade['fee']}, Total: ${trade['totalDeduction']}")
                
                # Store for weighted average test
                self.first_nvda_trade = trade
                return True
            else:
                print(f"❌ Trade failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Buy trade test error: {e}")
            return False
    
    def test_weighted_average_entry(self):
        """Test weighted average entry price with second NVDA purchase"""
        print("\n⚖️ Testing Weighted Average Entry...")
        
        try:
            # Execute second BUY order for same asset
            trade_data = {
                "symbol": "NVDA",
                "type": "stock", 
                "action": "BUY",
                "quantity": 3
            }
            
            response = self.session.post(
                f"{self.base_url}/api/trade",
                json=trade_data,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                trade = result['trade']
                
                # Validate that position quantity is combined (5 + 3 = 8)
                if trade['newPositionQuantity'] != 8:
                    print(f"❌ Expected position quantity 8, got {trade['newPositionQuantity']}")
                    return False
                
                # Get positions to verify single position with averaged price
                pos_response = self.session.get(f"{self.base_url}/api/positions", timeout=10)
                if pos_response.status_code != 200:
                    print(f"❌ Failed to get positions: {pos_response.status_code}")
                    return False
                
                positions = pos_response.json()['positions']
                nvda_positions = [p for p in positions if p['symbol'] == 'NVDA' and p['status'] == 'OPEN']
                
                if len(nvda_positions) != 1:
                    print(f"❌ Expected 1 NVDA position, got {len(nvda_positions)}")
                    return False
                
                position = nvda_positions[0]
                if position['quantity'] != 8:
                    print(f"❌ Expected position quantity 8, got {position['quantity']}")
                    return False
                
                # Calculate expected weighted average
                first_trade = self.first_nvda_trade
                expected_avg = ((5 * first_trade['executedPrice']) + (3 * trade['executedPrice'])) / 8
                
                if abs(position['entry_price'] - expected_avg) > 0.001:
                    print(f"❌ Weighted average mismatch: expected {expected_avg:.5f}, got {position['entry_price']}")
                    return False
                
                print(f"✅ Weighted Average Entry: {position['quantity']} units at ${position['entry_price']:.5f}")
                print(f"   📊 First: 5 @ ${first_trade['executedPrice']}, Second: 3 @ ${trade['executedPrice']}")
                
                # Store for sell test
                self.nvda_position = position
                return True
            else:
                print(f"❌ Second trade failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Weighted average test error: {e}")
            return False
    
    def test_sell_trade_with_realized_pnl(self):
        """Test SELL order with realized P&L calculation"""
        print("\n📈 Testing SELL Trade with Realized P&L...")
        
        try:
            # Get current account for P&L comparison
            pre_response = self.session.get(f"{self.base_url}/api/account", timeout=10)
            if pre_response.status_code != 200:
                print(f"❌ Failed to get pre-sell account: {pre_response.status_code}")
                return False
            
            pre_account = pre_response.json()
            
            # Execute SELL order (partial position)
            trade_data = {
                "symbol": "NVDA",
                "type": "stock",
                "action": "SELL", 
                "quantity": 3  # Sell 3 out of 8 units
            }
            
            response = self.session.post(
                f"{self.base_url}/api/trade",
                json=trade_data,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                trade = result['trade']
                
                # Validate sell trade structure
                required_fields = [
                    'marketPrice', 'executedPrice', 'slippage', 'totalValue',
                    'fee', 'netProceeds', 'realizedPnl', 'remainingQuantity'
                ]
                missing_fields = [field for field in required_fields if field not in trade]
                if missing_fields:
                    print(f"❌ Missing sell trade fields: {missing_fields}")
                    return False
                
                # Validate fee deducted from proceeds
                expected_proceeds = trade['totalValue'] - trade['fee']
                if abs(trade['netProceeds'] - expected_proceeds) > 0.01:
                    print(f"❌ Net proceeds mismatch: expected {expected_proceeds}, got {trade['netProceeds']}")
                    return False
                
                # Validate remaining quantity
                if trade['remainingQuantity'] != 5:  # 8 - 3 = 5
                    print(f"❌ Expected remaining quantity 5, got {trade['remainingQuantity']}")
                    return False
                
                # Validate realized P&L calculation
                position = self.nvda_position
                expected_pnl = (trade['executedPrice'] - position['entry_price']) * 3
                if abs(trade['realizedPnl'] - expected_pnl) > 0.01:
                    print(f"❌ Realized P&L mismatch: expected {expected_pnl}, got {trade['realizedPnl']}")
                    return False
                
                print(f"✅ SELL Trade: {trade['quantity']} NVDA at ${trade['executedPrice']}")
                print(f"   💰 Net Proceeds: ${trade['netProceeds']}, Realized P&L: ${trade['realizedPnl']:.2f}")
                print(f"   📊 Remaining: {trade['remainingQuantity']} units")
                return True
            else:
                print(f"❌ Sell trade failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Sell trade test error: {e}")
            return False
    
    def test_account_snapshots(self):
        """Test GET /api/account/snapshots - Equity curve data"""
        print("\n📈 Testing Account Snapshots...")
        
        try:
            response = self.session.get(f"{self.base_url}/api/account/snapshots", timeout=10)
            
            if response.status_code == 200:
                snapshots = response.json()['snapshots']
                
                if len(snapshots) == 0:
                    print("❌ No snapshots found")
                    return False
                
                # Validate snapshot structure
                snapshot = snapshots[0]
                required_fields = ['equity', 'balance', 'positions_value', 'open_pnl', 'created_at']
                missing_fields = [field for field in required_fields if field not in snapshot]
                if missing_fields:
                    print(f"❌ Missing snapshot fields: {missing_fields}")
                    return False
                
                # Should have multiple snapshots from our trades
                if len(snapshots) < 3:  # Registration + 2 buys + 1 sell = 4 minimum
                    print(f"⚠️ Expected at least 3 snapshots, got {len(snapshots)} (might be normal)")
                
                print(f"✅ Account Snapshots: {len(snapshots)} entries")
                print(f"   📊 Latest: Equity ${snapshot['equity']}, Balance ${snapshot['balance']}")
                return True
            else:
                print(f"❌ Snapshots API failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Snapshots test error: {e}")
            return False
    
    def test_trade_history(self):
        """Test GET /api/trades - Trade history with fees and slippage"""
        print("\n📋 Testing Trade History...")
        
        try:
            response = self.session.get(f"{self.base_url}/api/trades", timeout=10)
            
            if response.status_code == 200:
                trades = response.json()['trades']
                
                if len(trades) == 0:
                    print("❌ No trades found")
                    return False
                
                # Should have at least our 3 trades (2 buys + 1 sell)
                if len(trades) < 3:
                    print(f"⚠️ Expected at least 3 trades, got {len(trades)}")
                
                # Validate trade structure
                trade = trades[0]
                required_fields = [
                    'symbol', 'side', 'quantity', 'price', 'total_value',
                    'fee_amount', 'slippage', 'market_price'
                ]
                missing_fields = [field for field in required_fields if field not in trade]
                if missing_fields:
                    print(f"❌ Missing trade fields: {missing_fields}")
                    return False
                
                print(f"✅ Trade History: {len(trades)} trades")
                
                # Show last few trades
                for i, trade in enumerate(trades[:3]):
                    print(f"   {i+1}. {trade['side']} {trade['quantity']} {trade['symbol']} @ ${trade['price']:.5f} (Fee: ${trade['fee_amount']})")
                
                return True
            else:
                print(f"❌ Trade history API failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Trade history test error: {e}")
            return False
    
    def test_limit_orders(self):
        """Test limit order functionality"""
        print("\n📝 Testing Limit Orders...")
        
        try:
            # Create limit order
            order_data = {
                "symbol": "AAPL",
                "type": "stock",
                "action": "BUY",
                "quantity": 2,
                "limitPrice": 150.00
            }
            
            response = self.session.post(
                f"{self.base_url}/api/orders/limit",
                json=order_data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                order = result['order']
                
                # Validate order creation
                if order['status'] != 'PENDING':
                    print(f"❌ Expected order status PENDING, got {order['status']}")
                    return False
                
                order_id = order['id']
                print(f"✅ Limit Order Created: {order['quantity']} {order['symbol']} @ ${order['limitPrice']}")
                
                # Get pending orders
                pending_response = self.session.get(f"{self.base_url}/api/orders/pending", timeout=10)
                if pending_response.status_code != 200:
                    print(f"❌ Failed to get pending orders: {pending_response.status_code}")
                    return False
                
                pending_orders = pending_response.json()['orders']
                if len(pending_orders) == 0:
                    print("❌ No pending orders found")
                    return False
                
                print(f"✅ Pending Orders: {len(pending_orders)}")
                
                # Cancel order
                cancel_response = self.session.delete(f"{self.base_url}/api/orders/{order_id}", timeout=10)
                if cancel_response.status_code != 200:
                    print(f"❌ Failed to cancel order: {cancel_response.status_code}")
                    return False
                
                print("✅ Order Cancelled Successfully")
                return True
            else:
                print(f"❌ Limit order creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Limit orders test error: {e}")
            return False
    
    def test_validation_scenarios(self):
        """Test various validation scenarios"""
        print("\n🔒 Testing Validation Scenarios...")
        
        validation_tests = [
            {
                "name": "Sell more than owned",
                "data": {"symbol": "NVDA", "type": "stock", "action": "SELL", "quantity": 100},
                "should_fail": True
            },
            {
                "name": "Buy with insufficient balance",  
                "data": {"symbol": "TSLA", "type": "stock", "action": "BUY", "quantity": 10000},
                "should_fail": True
            },
            {
                "name": "Invalid quantity (negative)",
                "data": {"symbol": "AAPL", "type": "stock", "action": "BUY", "quantity": -5},
                "should_fail": True
            },
            {
                "name": "Invalid quantity (zero)",
                "data": {"symbol": "AAPL", "type": "stock", "action": "BUY", "quantity": 0},
                "should_fail": True
            }
        ]
        
        all_passed = True
        
        for test in validation_tests:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/trade",
                    json=test['data'],
                    timeout=10
                )
                
                if test['should_fail']:
                    if response.status_code == 200:
                        print(f"❌ {test['name']}: Should have failed but succeeded")
                        all_passed = False
                    else:
                        print(f"✅ {test['name']}: Correctly rejected ({response.status_code})")
                else:
                    if response.status_code != 200:
                        print(f"❌ {test['name']}: Should have succeeded but failed")
                        all_passed = False
                    else:
                        print(f"✅ {test['name']}: Correctly accepted")
                        
            except Exception as e:
                print(f"❌ {test['name']}: Test error: {e}")
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self):
        """Run all test scenarios"""
        print("🚀 Paper Trading Engine Backend Test Suite")
        print("=" * 50)
        
        # Authentication
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Run all tests
        tests = [
            ("Trading Configuration", self.test_trading_configuration),
            ("Account Summary", self.test_account_summary), 
            ("BUY Trade with Fees & Slippage", self.test_buy_trade_with_fees_slippage),
            ("Weighted Average Entry", self.test_weighted_average_entry),
            ("SELL Trade with Realized P&L", self.test_sell_trade_with_realized_pnl),
            ("Account Snapshots", self.test_account_snapshots),
            ("Trade History", self.test_trade_history),
            ("Limit Orders", self.test_limit_orders),
            ("Validation Scenarios", self.test_validation_scenarios),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ Test '{test_name}' threw exception: {e}")
                failed += 1
        
        # Final summary
        print(f"\n{'='*50}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*50}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        return failed == 0

def main():
    import os
    
    # Get base URL from environment or use default
    base_url = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://invest-dash-47.preview.emergentagent.com')
    
    print(f"🎯 Testing Paper Trading Engine at: {base_url}")
    
    # Run tests
    tester = PaperTradingEngineTests(base_url)
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Paper Trading Engine is working correctly.")
        exit(0)
    else:
        print("\n💥 Some tests failed. Check the output above for details.")
        exit(1)

if __name__ == "__main__":
    main()