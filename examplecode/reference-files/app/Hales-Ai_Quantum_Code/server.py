from flask import Flask, jsonify
from flask_cors import CORS
from qiskit import QuantumCircuit
from qiskit_aer import Aer

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/quantum-measurement')
def get_quantum_measurement():
    # Create a quantum circuit with 2 qubits and 2 classical bits
    qc = QuantumCircuit(2, 2)

    # Apply Hadamard gate to create superposition
    qc.h(0)

    # Apply CNOT gate to entangle the qubits
    qc.cx(0, 1)

    # Measure both qubits
    qc.measure([0, 1], [0, 1])

    # Run the circuit on the QASM simulator
    backend = Aer.get_backend('qasm_simulator')
    job = backend.run(qc, shots=1024)
    result = job.result()
    counts = result.get_counts()
    
    # Create response with explicit headers
    response = jsonify({
        '00': counts.get('00', 0),
        '11': counts.get('11', 0)
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
    
    return response

if __name__ == '__main__':
    app.run(port=5000, debug=True)