# import the necessary parts of the bluepy library
from bluepy.btle import Scanner, DefaultDelegate
import paho.mqtt.client as mqtt
import sys
broker_address="10.10.10.1"
mac="d1:00:00:03:47:0d"
place=sys.argv[1]
print place
client = mqtt.Client()
client.connect(broker_address, 1883, 60)

# create a delegate class to receive the BLE broadcast packets
class ScanDelegate(DefaultDelegate):
    def __init__(self):
        DefaultDelegate.__init__(self)

    # when this python script discovers a BLE broadcast packet, print a message with the device's MAC address
    def handleDiscovery(self, dev, isNewDev, isNewData):
        if mac == dev.addr:
                client.publish("room_presence/"+place+"/"+dev.addr,dev.rssi)
                print "device", dev.addr, dev.rssi

# create a scanner object that sends BLE broadcast packets to the ScanDelegate
scanner = Scanner().withDelegate(ScanDelegate())

# start the scanner and keep the process running
#scanner.start()
while True:
    print "Still running..."
    devs = scanner.scan(10, passive=True)
    found = 0
    for x in devs:
        if x.addr==mac:
                found = 1
    if found==0:
        print "reset"
        client.publish("room_presence/"+place+"/"+mac,"-99")
