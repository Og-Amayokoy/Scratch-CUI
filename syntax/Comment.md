# Comment on Scratch text base

you can place comments in your source code that are not executed as part of the program.

## How to write comment

Comment has 2 type.

1. ```//``` (two slashes).
A single line comment starts with ```//``` character and they extend  from ```//``` to the end of the line.

2. ```/*```(a slash and asterisk) and ```*/```(an asterisk and slash)
```/*``` and ```*/``` can span several lines. 

__Code1__
```
//This is single comment
/*
This is comment.
You can span several lines.
*/
/* of cource you can use a single comment to.*/
when flag clicked
say "How are you?"

```
__Result1(on CUI execution environment)__ 


```How are you?```  

__Result1(on GUI execution environment)__

![Result 1](https://github.com/Yokoyama-Go/Scratch-TextBase/blob/master/pictures/How_are_you.png)

__Code2__
```
//Comment in Comment
/*AAA
/*BBB*/
CCC
*/
//For debug, I name to /*s and */s.
//The first /*, I'll name "1/*".
//Before BBB /*, I'll name "2/*".
//After BBB */, I'll name "1*/".
//Last */, I'll name "2*/".
when flag clicked
say "Hi, I'm happy to see you!"
```

__Result2(on CUI execution environment)__  

```E: There are Syntax error(41,1~3;41,1)```

__Result2(on GUI execution environment)__



![result2](https://github.com/Yokoyama-Go/Scratch-TextBase/blob/master/pictures/error.png)

Because Interpret that
```
 "1/*" is cue of start comment. I see. So, I'll through after all of before */. Oh,there is /*(it's "2/*")! But, I haven't found */ so, keep through.
 I find */ (It's "1*/"). Comment ends here. Whoa, there is "CCC" and */(it's "2*/"). I don't know. I'll send error massage... 
 ```

