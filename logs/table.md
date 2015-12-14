
Spawned Broker \ ms/msg |Realtime Total: 100    |1000   |10000                  |Retained Total: 100    |1000   |10000  |Echo Roundtrip Total (10000)   | Send#1->Recv#1 (10000)    |
------------------------|-----------------------|-------|-----------------------|-----------------------|-------|-------|-------------------------------|---------------------------|
Mosca                   |8.8ms                  |7.8ms  |15.4ms                 |8.8ms                  |2.8ms  |FAILS  |20.5ms                         |                           |
Mosquitto               |2.0ms                  |2.0ms  |3.7ms                  |0.9ms                  |0.5ms  |0.5ms  |~200ms (before termination)    |                           |
Aedes                   |11.8ms                 |7.4ms  |~10.7 (failed at 6738) |FAILS                  |FAILS  |FAILS  |~10.8 (failed at 5549)         |                           |
