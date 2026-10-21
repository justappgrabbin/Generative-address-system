#include <stdio.h>

struct point { int x; int y; };

int fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

int main(void) {
    int arr[5];
    int i;
    int sum = 0;
    for (i = 0; i < 5; i++) {
        arr[i] = (i + 1) * (i + 1);
        sum += arr[i];
    }
    printf("fib(10) = %d\n", fib(10));
    printf("sum of squares = %d\n", sum);
    struct point p;
    p.x = 3;
    p.y = 4;
    printf("p = (%d, %d) dist2 = %d\n", p.x, p.y, p.x * p.x + p.y * p.y);
    double avg = sum / 5.0;
    printf("avg = %.2f, int div = %d\n", avg, sum / 2);
    const char *s = "Synthia";
    printf("Hello, %s! %c\n", s, s[0]);
    int k = 0;
    while (k < 10) { k += 3; if (k == 6) continue; }
    printf("k = %d\n", k);
    return 0;
}
