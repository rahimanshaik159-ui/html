 #include <iostream>
#include <fstream>
#include <conio.h>
using namespace std;

int main() {
    fstream file;
    char line[100];

    // Write data to file
    file.open("rahi.txt", ios::out);
    if (!file) {
        cout << "Error while opening file for writing!" << endl;
    } else {
        cout << "File opened for writing." << endl;
        file << "Hello to all!" << endl;
        file << "This is demo file for operation test like open close read write." << endl;
        file.close(); // important to flush data
        cout << "Data written successfully. File closed." << endl;
    }

    // Read data from file
    file.open("rahi.txt", ios::in);
    if (!file) {
        cout << "Error while opening file for reading!" << endl;
    } else {
        cout << "File opened for reading:" << endl;
        while (file.getline(line, 100)) {
            cout << line << endl;
        }
        file.close();
        cout << "File closed after reading." << endl;
    }

    getch();
    return 0;
}