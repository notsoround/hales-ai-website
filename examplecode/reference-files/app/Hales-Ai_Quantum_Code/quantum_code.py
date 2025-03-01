from qiskit import QuantumCircuit
from qiskit_aer import Aer
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
print(counts)