from dataclasses import dataclass
from enum import Enum

class Mode(Enum):
    TOWARD = 1
    AWAY = 2

@dataclass(frozen=True)
class Point:
    x: int
    y: int
    def dist2(self):
        return self.x * self.x + self.y * self.y

def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

squares = [i * i for i in range(1, 6)]
print(f"fib(10) = {fib(10)}")
print(",".join(str(s) for s in squares))
p = Point(3, 4)
print(p, p.dist2(), Mode.AWAY, Mode(1).name)
print({k: v for k, v in zip("ab", [1, 2])}, round(sum(squares) / 5, 2))
