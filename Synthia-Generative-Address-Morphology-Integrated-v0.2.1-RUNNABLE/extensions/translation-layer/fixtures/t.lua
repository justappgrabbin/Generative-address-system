local function fib(n)
  if n < 2 then return n end
  return fib(n - 1) + fib(n - 2)
end
print("fib(10) = " .. fib(10))
local t = {}
for i = 1, 5 do t[#t + 1] = i * i end
print(table.concat(t, ","))
local s = 0
for _, v in ipairs({3, 4, 5}) do s = s + v end
print(s)
local Greeter = {}
Greeter.__index = Greeter
function Greeter.new(name)
  local self = setmetatable({}, Greeter)
  self.name = name
  return self
end
function Greeter:greet() return "Hello, " .. self.name .. "!" end
print(Greeter.new("Synthia"):greet())
print(string.format("%d %.2f %s", 42, 3.14159, "ok"))
local n = 0
while n < 3 do n = n + 1 end
print(n, 7 // 2, 7 / 2, 2^10, #"abc", 10 % 3 == 1 and "yes" or "no")
