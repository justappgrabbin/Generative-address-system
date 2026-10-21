def fib(n)
  n < 2 ? n : fib(n - 1) + fib(n - 2)
end

class Greeter
  attr_reader :name
  def initialize(name)
    @name = name
  end

  def greet
    "Hello, #{@name}!"
  end
end

squares = (1..5).map { |x| x * x }
puts "fib(10) = #{fib(10)}"
puts squares.join(",")
total = 0
[3, 4, 5].each do |v|
  total += v
end
puts total
puts Greeter.new("Synthia").greet
h = { "a" => 1, "b" => 2 }
h.each { |k, v| puts "#{k}=#{v}" }
puts squares.select { |x| x.even? }.inspect
puts squares.sum if squares.length == 5
