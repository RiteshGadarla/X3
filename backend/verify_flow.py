import requests
import json

base_url = "http://localhost:8000/api/v1"

def test_flow():
    # 1. Submit ticket
    print("Submitting ticket...")
    payload = {
        "customer_name": "John Doe",
        "customer_email": "john@doe.com",
        "subject": "System Verification",
        "description": "Testing the full system integration.",
        "category": "Technical",
        "ai_disclosure_accepted": True
    }
    res = requests.post(f"{base_url}/tickets/submit", json=payload)
    if res.status_code != 201:
        print(f"Error submitting: {res.status_code} - {res.text}")
        return
    ticket = res.json()
    print(f"Ticket submitted: {ticket['ticket_ref']}")

    # 2. Login
    print("\nLogging in as admin...")
    login_payload = {"email": "admin@csagent.ai", "password": "Admin@1234!"}
    res = requests.post(f"{base_url}/auth/login", json=login_payload)
    if res.status_code != 200:
        print(f"Error logging in: {res.status_code} - {res.text}")
        return
    auth_data = res.json()
    token = auth_data["access_token"]
    print("Login successful")

    # 3. List tickets
    print("\nFetching ticket queue...")
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{base_url}/tickets", headers=headers)
    if res.status_code != 200:
        print(f"Error fetching: {res.status_code} - {res.text}")
        return
    tickets = res.json()
    print(f"Total tickets in queue: {tickets['total']}")
    
    found = any(t['ticket_ref'] == ticket['ticket_ref'] for t in tickets['items'])
    if found:
        print(f"✅ Ticket {ticket['ticket_ref']} found in queue!")
    else:
        print(f"❌ Ticket {ticket['ticket_ref']} NOT found in queue.")

if __name__ == "__main__":
    test_flow()
